(() => {
  'use strict';
  const node = typeof module === 'object';
  const rules = node ? require('./rules.js') : globalThis.GoridorRules;
  const reading = node ? require('./lecture.js') : globalThis.GoridorReading;
  const initialWeights = [1.8, 1.5, 1.0, 1.4, .28, .18];
  const side = game => game.turn === 1 ? 1 : -1;

  function estimate(features, weights) {
    return Math.tanh(features.reduce((sum, x, i) => sum + x * weights[i], 0) / 3);
  }

  function terminal(game) {
    const {totals} = rules.score(game, []);
    return Math.sign(totals[1] - totals[2]);
  }

  function value(game, info, weights) {
    const area = info.space / game.size + info.features[0] + info.features[1];
    return .70 * estimate(info.features, weights) + .30 * Math.tanh(area / 2);
  }

  function takeLastLiberty(game, group) {
    if (group.liberties.size !== 1) return null;
    const [p] = group.liberties;
    const move = {type:'stone', row:Math.floor(p/game.size), col:p%game.size};
    const next = rules.play(game, move).game;
    return next ? {next, point:p, gain:next.captures[game.turn] - game.captures[game.turn]} : null;
  }

  function choices(game, info, random, width) {
    const pool = reading.ranked(game, info, random);
    const children = [];
    const late = info.occupied > game.stones.length * .48;
    const score = late ? rules.score(game, []) : null;
    for (const [list, limit] of [[pool.stones, width], [pool.walls, Math.max(2, Math.ceil(width / 3))]]) {
      let count = 0;
      for (const {move, rank} of list) {
        const p = move.row * game.size + move.col;
        if (move.type === 'stone' && score?.ownership[p] === game.turn && rank < 5) continue;
        const next = rules.play(game, move).game;
        if (!next) continue;
        let priority = rank;
        if (move.type === 'stone') {
          const group = rules.groupAt(next.stones, next.size, next.edges, p);
          const gain = next.captures[game.turn] - game.captures[game.turn];
          if (group.liberties.size === 1) {
            const reply = takeLastLiberty(next, group);
            if (reply) {
              const capturingChain = rules.groupAt(reply.next.stones, game.size, game.edges, reply.point);
              const recapture = takeLastLiberty(reply.next, capturingChain);
              const trade = gain - reply.gain + (recapture?.gain ?? 0);
              if (trade < 0 && !gain) continue;
              if (trade < 0) priority = Math.min(priority, trade - 2);
              if (trade > gain) priority += 2 + Math.log2(1 + trade);
            }
          }
        }
        children.push({move, game:next, rank:priority});
        if (++count >= limit) break;
      }
    }
    if (!children.length || late) {
      const winningPass = late && game.passes === 1 && score.totals[game.turn] > score.totals[3-game.turn];
      children.push({move:{type:'pass'}, game:rules.pass(game), rank:winningPass ? 25 : -1.4});
    }
    return children.sort((a,b) => b.rank - a.rank);
  }

  // Read alternating forcing replies to a quiet evaluation. A chain can sometimes
  // be saved by capturing a different chain, so all ataris on the board participate.
  function read(game, info, weights, cache, depth) {
    let best = value(game, info, weights);
    if (!depth) return best;
    const targets = new Map();
    for (const group of info.groups) {
      if (group.liberties.size !== 1) continue;
      const [p] = group.liberties;
      targets.set(p, (targets.get(p) || 0) + group.points.length);
    }
    const order = [...targets].sort((a,b) => b[1] - a[1]).slice(0, 4);
    const sense = side(game);
    for (const [p] of order) {
      const next = rules.play(game, {type:'stone',row:Math.floor(p/game.size),col:p%game.size}).game;
      if (!next) continue;
      const reply = read(next, reading.inspect(next, cache), weights, cache, depth-1);
      if (sense * reply > sense * best) best = reply;
    }
    return best;
  }

  // PUCT uses tactical priors to allocate simulations. Root moves additionally
  // get a two-reply tactical reading before the statistical search commits to one.
  function search(game, {weights = initialWeights, random = Math.random, iterations = 128,
    budgetMs = Infinity, width = 8, rollout = 2} = {}) {
    if (game.passes >= 2) return null;
    const deadline = performance.now() + budgetMs;
    const cache = new WeakMap();
    const root = {game, visits:0, sum:0};
    const inspectNode = n => n.info ??= reading.inspect(n.game, cache);
    function expand(parent) {
      const atRoot = parent === root;
      const list = choices(parent.game, inspectNode(parent), random, atRoot ? 2*width : width);
      if (atRoot) {
        const until = Math.min(deadline, performance.now() + budgetMs * .24);
        for (const child of list) {
          if (performance.now() >= until) break;
          if (child.move.type === 'pass') continue;
          const adjustment = reading.ladderAdjustment(game, child, inspectNode(child), until);
          child.rank += adjustment;
          child.tactics = Math.tanh(adjustment / 7);
        }
        list.sort((a,b) => b.rank - a.rank);
      }
      const maxRank = list[0].rank;
      let mass = 0;
      for (const child of list) {
        child.prior = .045 + Math.exp((child.rank-maxRank) / 2.8);
        mass += child.prior;
        child.visits = 0;
        child.sum = 0;
      }
      for (const child of list) child.prior /= mass;
      parent.children = list;
    }

    expand(root);
    const rootValue = value(game, root.info, weights);
    for (const child of root.children) {
      child.initial = rootValue;
      if (child.game.passes === 2) child.initial = terminal(child.game);
      else if (performance.now() < deadline) {
        child.initial = read(child.game, inspectNode(child), weights, cache, Math.min(2,rollout));
        child.initial += side(game) * .18 * (child.tactics || 0);
      }
    }

    for (let i=0; i<iterations && (i===0 || performance.now()<deadline); i++) {
      let current = root;
      const path = [current];
      while (current.children) {
        let best, high = -Infinity;
        const exploration = 1.65 * Math.sqrt(current.visits+1);
        for (const child of current.children) {
          const initial = child.initial ?? (current.visits ? current.sum/current.visits : rootValue);
          const mean = (child.sum + initial*2) / (child.visits+2);
          const rank = side(current.game)*mean + exploration * child.prior / (child.visits+1);
          if (rank > high) { high = rank; best = child; }
        }
        current = best;
        path.push(current);
        if (current.visits && !current.children && current.game.passes < 2) expand(current);
      }
      const result = current.game.passes === 2 ? terminal(current.game)
        : read(current.game, inspectNode(current), weights, cache, Math.min(1,rollout));
      for (const ancestor of path) { ancestor.sum += result; ancestor.visits++; }
    }
    return root.children.reduce((a,b) => b.visits > a.visits ? b : a).move;
  }

  const api = { initialWeights, inspect:reading.inspect, estimate, search, terminal };
  if (node) module.exports = api;
  else globalThis.GoridorAI = api;
})();
