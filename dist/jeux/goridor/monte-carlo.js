(() => {
  'use strict';
  const rules = typeof module === 'object' ? require('./rules.js') : globalThis.GoridorRules;
  // Positive values favour Black. Both self-play and the browser use the same representation.
  const initialWeights = [1.8, 1.5, 1.0, 1.4, .28, .18];
  const pass = { type: 'pass' };
  function inspect(game) {
    const { size, stones, edges, turn } = game;
    const urgent = new Map();
    const stonesToTry = [];
    const wallsToTry = [];
    const visited = new Set();
    let material = 0, pressure = 0, influence = 0, occupied = 0;
    for (let p = 0; p < stones.length; p++) {
      const color = stones[p];
      if (color) {
        occupied++;
        const sign = color === 1 ? 1 : -1;
        material += sign;
        if (visited.has(p)) continue;
        const group = rules.groupAt(stones, size, edges, p, visited);
        if (group.liberties.size <= 2) {
          pressure -= sign * group.points.length / group.liberties.size;
          for (const lib of group.liberties) {
            const priority = (group.liberties.size === 1 ? 4 : .8) *
              (1 + Math.log1p(group.points.length)) * (color === turn ? .88 : 1);
            urgent.set(lib, Math.max(urgent.get(lib) || 0, priority));
          }
        }
        continue;
      }
      const near = rules.neighbors(p, size, edges);
      let black = 0, white = 0;
      for (const n of near) {
        if (stones[n] === 1) black++;
        if (stones[n] === 2) white++;
      }
      influence += (black && !white ? 1 : white && !black ? -1 : 0);
      const own = turn === 1 ? black : white;
      const enemy = turn === 1 ? white : black;
      if (!near.length || own === near.length) continue;
      const row = Math.floor(p / size), col = p % size;
      const line = Math.min(row, col, size - row - 1, size - col - 1);
      stonesToTry.push({ p, prior: (enemy && own ? 1.2 : 0) + (enemy ? .4 : 0)
        + Math.min(2, line) * .35 - own * .24 });
    }
    if (game.stock[turn] && occupied) {
      for (let row = 0; row < size - 1; row++) for (let col = 0; col < size - 1; col++) {
        const p = row * size + col;
        const square = [stones[p], stones[p+1], stones[p+size], stones[p+size+1]];
        if (square.includes(0) && square.includes(3 - turn)) wallsToTry.push({ row, col });
      }
    }
    const features = [(game.captures[1] - game.captures[2] - rules.KOMI) / size,
      material / size, influence / size, pressure / size, (game.stock[1] - game.stock[2]) / 2, 1];
    return { features, urgent, stonesToTry, wallsToTry, occupied };
  }

  function estimate(features, weights) {
    return Math.tanh(features.reduce((sum, x, i) => sum + x * weights[i], 0) / 3);
  }

  function candidates(game, info, random, width) {
    const { stonesToTry, urgent, wallsToTry, occupied } = info;
    const legal = [];
    const area = game.stones.length;
    const late = occupied > area * .60;
    const ownership = late ? rules.score(game, []).ownership : null;
    for (const item of stonesToTry) item.rank = item.prior + (urgent.get(item.p) || 0) + 3 * random();
    stonesToTry.sort((a,b) => b.rank - a.rank);
    for (const {p} of stonesToTry) {
      if (ownership && ownership[p] === game.turn && !(urgent.get(p) >= 4)) continue;
      const move = { type: 'stone', row: Math.floor(p / game.size), col: p % game.size };
      const next = rules.play(game, move).game;
      if (!next) continue;
      const gain = next.captures[game.turn] - game.captures[game.turn];
      const group = rules.groupAt(next.stones, next.size, next.edges, p);
      if (!gain && group.liberties.size <= 1) continue;
      legal.push({ move, game: next, prior: Math.min(2, gain) + (urgent.get(p) || 0) * .08 });
      if (legal.length >= width) break;
    }
    // Give walls their own quota, so they cannot drown out stone moves on an open board.
    let wallCount = 0;
    for (let i = 0; i < wallsToTry.length && wallCount < Math.ceil(width / 4); i++) {
      const j = i + Math.floor(random() * (wallsToTry.length - i));
      [wallsToTry[i], wallsToTry[j]] = [wallsToTry[j], wallsToTry[i]];
      const first = random() < .5 ? 'vertical' : 'horizontal';
      for (const orientation of [first, first === 'vertical' ? 'horizontal' : 'vertical']) {
        const move = { type: 'wall', ...wallsToTry[i], orientation };
        const next = rules.play(game, move).game;
        if (!next) continue;
        legal.push({move, game: next, prior: -.24});
        wallCount++;
        break;
      }
    }
    if (!legal.length || late) legal.push({ move: pass, game: rules.pass(game), prior: late ? .08 : 0 });
    return legal;
  }

  function terminal(game) {
    const {totals} = rules.score(game, []);
    return Math.sign(totals[1] - totals[2]);
  }

  // UCT tree search with short stochastic continuations and a bounded value estimate.
  function search(game, { weights = initialWeights, random = Math.random, iterations = 128,
    budgetMs = Infinity, width = 8, rollout = 2 } = {}) {
    if (game.passes >= 2) return null;
    const end = performance.now() + budgetMs;
    const root = { game, visits: 0, value: 0 };
    for (let i = 0; i < iterations && (i === 0 || performance.now() < end); i++) {
      let node = root;
      const path = [root];
      while (node.game.passes < 2) {
        if (!node.children) {
          node.children = candidates(node.game, inspect(node.game), random, width)
            .map(choice => ({ ...choice, visits: 0, value: 0, tie: random() * .12 }));
        }
        const side = node.game.turn === 1 ? 1 : -1;
        const exploration = Math.log(node.visits + 2);
        let best = null, high = -Infinity;
        for (const child of node.children) {
          const rank = child.visits
            ? side * child.value / child.visits + 1.1 * Math.sqrt(exploration / child.visits) + child.prior / (2 + child.visits)
            : 20 + child.prior + child.tie;
          if (rank > high) { best = child; high = rank; }
        }
        node = best;
        path.push(node);
        if (!node.visits) break;
      }
      let position = node.game;
      for (let k = 0; k < rollout && position.passes < 2; k++) {
        const choices = candidates(position, inspect(position), random, 2);
        const pick = random() < .72 ? 0 : Math.floor(random() * choices.length);
        position = choices[pick].game;
      }
      const value = position.passes === 2 ? terminal(position) : estimate(inspect(position).features, weights);
      for (const ancestor of path) { ancestor.visits++; ancestor.value += value; }
    }
    const side = game.turn === 1 ? 1 : -1;
    return root.children.filter(c => c.visits).sort((a,b) => b.visits - a.visits ||
      side * (b.value/b.visits - a.value/a.visits) || b.prior - a.prior)[0].move;
  }

  const api = { initialWeights, inspect, estimate, search, terminal };
  if (typeof module === 'object') module.exports = api;
  else globalThis.GoridorAI = api;
})();
