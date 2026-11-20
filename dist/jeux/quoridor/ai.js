"use strict";
const QuoridorAI = (() => {
  const Q = typeof module !== 'undefined' && module.exports ? require('./engine.js') : Quoridor;
  const LEVELS = [null,
    { name: 'Découverte', depth: 1, beam: 2, budget: 25, noise: 1.5 },
    { name: 'Débutant', depth: 1, beam: 3, budget: 45, noise: .8 },
    { name: 'Apprenti', depth: 2, beam: 3, budget: 90, noise: .3 },
    { name: 'Joueur', depth: 3, beam: 4, budget: 180, noise: .12 },
    { name: 'Habitué', depth: 4, beam: 4, budget: 320, noise: 0 },
    { name: 'Stratège', depth: 5, beam: 5, budget: 500, noise: 0 },
    { name: 'Expert', depth: 6, beam: 5, budget: 800, noise: 0 },
    { name: 'Maître', depth: 8, beam: 6, budget: 1200, noise: 0 },
  ];
  const WALLS = Array.from({ length: 128 }, (_, id) => ({
    type: 'wall', r: Math.floor((id % 64) / 8), c: id % 8, o: id < 64 ? 'h' : 'v'
  }));
  const wallId = w => (w.o === 'v' ? 64 : 0) + w.r * 8 + w.c;
  const UNREACHABLE = 255;
  const WIN = 1000;

  // Flood from the entire finish edge. Every pawn move on this arrangement
  // of walls can then look up its remaining walking distance in constant time.
  function distanceField(edges, goal) {
    const field = new Uint8Array(81).fill(UNREACHABLE), queue = new Uint8Array(81);
    let head = 0, tail = 0;
    for (let pos = 0; pos < 81; pos++) {
      if (Q.goalReached(pos, goal)) { field[pos] = 0; queue[tail++] = pos; }
    }
    while (head < tail) {
      const pos = queue[head++];
      for (const next of edges[pos]) {
        if (next >= 0 && field[next] === UNREACHABLE) {
          field[next] = field[pos] + 1; queue[tail++] = next;
        }
      }
    }
    return field;
  }

  function readBoard(state) {
    const edges = Q.graph(state);
    return { edges, fields: state.players.map(p => distanceField(edges, p.goal)) };
  }

  function race(state, board) {
    const count = state.players.length;
    const moves = [], immediate = [], arrivals = [];
    for (const [i, player] of state.players.entries()) {
      const field = board.fields[i], walking = field[player.position];
      const legal = Q.moves(state, i, player.position, board.edges);
      const nextDistance = legal.reduce((d, to) => Math.min(d, field[to]), UNREACHABLE);
      moves.push(legal);
      immediate.push(nextDistance === 0);
      // Walls are permanent. A jump available now may disappear before a
      // later seat plays. Only credit it fully for the player about to act.
      const wait = (i - state.turn + count) % count;
      const turns = walking + Math.min(2, 1 + nextDistance - walking) * (wait ? .6 : 1);
      arrivals.push((immediate[i] ? 1 : turns) + wait / count);
    }
    const scores = state.players.map((p, i) => {
      const rivals = arrivals.filter((_, j) => j !== i);
      const reserve = state.players.filter((_, j) => j !== i).reduce((sum, other) => sum + other.walls, 0) / rivals.length;
      const lead = Math.min(...rivals) - arrivals[i];
      if (count === 2) return lead + .16 * (p.walls - reserve);
      // In a free-for-all, slowing down a trailing rival has little value.
      // Giving up our own progress to trade walls also benefits two bystanders.
      return lead - .34 * arrivals[i] + .08 * rivals.reduce((a, b) => a + b, 0) / rivals.length + .16 * (p.walls - reserve);
    });
    return { moves, immediate, scores };
  }

  // Histories contain positions before actions. A wall changes the routes:
  // revisiting a square behind a new obstruction can be the right decision.
  function pawnTrails(state, pastStates) {
    const trails = state.players.map(() => []);
    let after = state;
    for (let n = pastStates.length - 1; n >= 0; n--) {
      const past = pastStates[n];
      if (past.walls.length !== state.walls.length) break;
      const actor = past.turn, pos = past.players[actor].position;
      if (pos !== after.players[actor].position && trails[actor].length < 6) {
        trails[actor].unshift(pos);
      }
      after = past;
    }
    return trails;
  }

  function moveBias(board, state, to, trails) {
    const actor = state.turn, field = board.fields[actor];
    const progress = field[state.players[actor].position] - field[to];
    const ago = trails[actor].lastIndexOf(to);
    const recency = trails[actor].length - ago;
    const repetition = ago < 0 || progress > 0 ? 0 : 2.8 / recency;
    return .22 * progress - repetition;
  }

  function wallsAcross(a, b, ids) {
    const first = Math.min(a, b), r = Math.floor(first / 9), c = first % 9;
    if (Math.abs(a - b) === 9) {
      if (c < 8) ids.add(r * 8 + c);
      if (c > 0) ids.add(r * 8 + c - 1);
    } else {
      if (r < 8) ids.add(64 + r * 8 + c);
      if (r > 0) ids.add(64 + (r - 1) * 8 + c);
    }
  }

  // At the root consider every possible placement. In replies concentrate on
  // routes that opponents can use next, including both segments of a jump.
  function replyWalls(state, board) {
    const ids = new Set(), occupied = new Set(state.players.map(p => p.position));
    for (const [i, p] of state.players.entries()) {
      if (i === state.turn) continue;
      const field = board.fields[i], from = p.position;
      for (const next of board.edges[from]) {
        if (next < 0) continue;
        if (field[next] < field[from] || occupied.has(next)) wallsAcross(from, next, ids);
        if (occupied.has(next)) {
          for (const landing of board.edges[next]) {
            if (landing >= 0 && field[landing] < field[from]) wallsAcross(next, landing, ids);
          }
        }
      }
    }
    return Array.from(ids, id => WALLS[id]);
  }

  function evaluate(state) {
    if (state.winner !== null) return state.players.map((_, i) => i === state.winner ? WIN : -WIN);
    return race(state, readBoard(state)).scores;
  }

  function choose(state, level = 3, options = {}) {
    if (state.winner !== null) return { action: null, depth: 0, nodes: 0 };
    level = Math.max(1, Math.min(8, Math.round(level)));
    const settings = LEVELS[level], rng = options.random || Math.random;
    const start = performance.now(), deadline = start + (options.budget ?? settings.budget);
    const count = state.players.length, duel = count === 2, rootActor = state.turn;
    const emptyTrails = state.players.map(() => []);
    const initialTrails = options.trails || emptyTrails;
    const previousPositions = new Set(options.history);
    const boards = new Map();
    const timeout = Symbol('search deadline');
    let nodes = 0;
    function checkTime() { if (performance.now() >= deadline) throw timeout; }

    function boardWithWall(next) {
      const key = next.walls.map(wallId).sort((a, b) => a - b).join(',');
      let board = boards.get(key);
      if (!board) {
        board = readBoard(next);
        if (boards.size >= 1200) boards.clear();
        boards.set(key, board);
      }
      return board;
    }

    function nextTrails(parent, child, trails) {
      if (child.action.type === 'wall') return emptyTrails;
      if (child.action.type === 'pass') return trails;
      const actor = parent.turn, next = trails.slice();
      next[actor] = [...trails[actor].slice(-5), parent.players[actor].position];
      return next;
    }

    function candidates(parent, board, situation, trails, atRoot) {
      const actor = parent.turn, pawn = parent.players[actor], moves = situation.moves[actor];
      const win = moves.find(to => Q.goalReached(to, pawn.goal));
      const ranked = [];
      function add(action, next, geometry, bias) {
        nodes++;
        const info = race(next, geometry);
        // Which rival could finish first if we leave the position this way?
        let danger = 0;
        for (let step = 1; step < count; step++) {
          if (info.immediate[(actor + step) % count]) { danger = count - step; break; }
        }
        const rank = info.scores[actor] + bias;
        ranked.push({ action, state: next, board: geometry, info, bias, danger, rank });
      }
      if (win !== undefined) {
        const action = { type: 'move', to: win };
        return [{ action, state: Q.apply(parent, action, false), bias: 0, rank: WIN, danger: 0 }];
      }
      for (const to of moves) {
        const action = { type: 'move', to };
        const next = Q.apply(parent, action, false);
        let bias = moveBias(board, parent, to, trails);
        if (atRoot && previousPositions.size && previousPositions.has(Q.key(next))) bias -= 1.5;
        add(action, next, board, bias);
      }
      if (pawn.walls && (level > 1 || !moves.length)) {
        const placements = atRoot || !moves.length ? WALLS : replyWalls(parent, board);
        for (const wall of placements) {
          if (!atRoot) checkTime();
          if (Q.wallError(parent, wall, actor, false)) continue;
          const next = Q.apply(parent, wall, false), geometry = boardWithWall(next);
          if (next.players.some((p, i) => geometry.fields[i][p.position] === UNREACHABLE)) continue;
          add(wall, next, geometry, 0);
        }
      }
      if (!ranked.length) {
        const action = { type: 'pass' };
        add(action, Q.apply(parent, action, false), board, 0);
      }
      const leastDanger = level >= 3 ? Math.min(...ranked.map(c => c.danger)) : Infinity;
      const safe = ranked.filter(c => c.danger <= leastDanger).sort((a, b) => b.rank - a.rank);
      const width = atRoot ? settings.beam + 2 : duel ? settings.beam : Math.min(3, settings.beam);
      // Several almost identical walls must not prune the best racing move.
      const selected = safe.slice(0, width);
      const bestMove = safe.find(c => c.action.type === 'move');
      if (bestMove && !selected.includes(bestMove)) selected[selected.length - 1] = bestMove;
      return selected;
    }

    // The winner gets a higher score for finishing sooner. In a forced loss,
    // delay the finish and use progress to distinguish equally late defeats.
    function terminal(state, board, ply) {
      const reward = WIN - ply * 3;
      return state.players.map((p, i) => i === state.winner ? reward :
        -reward - (duel ? 0 : .15 * board.fields[i][p.position]));
    }

    function search(child, remaining, ply, trails, alpha, beta) {
      checkTime();
      if (!remaining) return child.info.scores;
      const actor = child.state.turn;
      const choices = child.replies ??= candidates(child.state, child.board, child.info, trails, false);
      let best = null;
      for (const option of choices) {
        const values = scoreOption(child.state, child.board, option, remaining - 1, ply + 1, trails, alpha, beta);
        if (!best || values[actor] > best[actor]) best = values;
        if (duel) {
          alpha = Math.max(alpha, best[actor]);
          if (alpha >= beta) break;
        }
      }
      return best;
    }

    function scoreOption(parent, board, option, remaining, ply, trails, alpha, beta) {
      if (option.state.winner !== null) return terminal(option.state, board, ply);
      // In a duel, each side maximizes the negative of its opponent's score.
      // At four seats each player instead maximizes their own component (MaxN).
      const values = search(option, remaining, ply, nextTrails(parent, option, trails),
        option.bias - beta, option.bias - alpha).slice();
      values[parent.turn] += option.bias;
      if (duel) values[1 - parent.turn] = -values[parent.turn];
      return values;
    }

    const board = readBoard(state);
    const roots = candidates(state, board, race(state, board), initialTrails, true);
    let best = roots[0], depth = 1;
    if (best.state.winner === null) {
      const jitter = new Map(roots.map(c => [c, settings.noise ? (rng() - .5) * settings.noise : 0]));
      const noisyRank = c => c.rank + jitter.get(c);
      best = roots.reduce((a, b) => noisyRank(a) >= noisyRank(b) ? a : b);
      for (let d = 2; d <= settings.depth; d++) {
        let choice = null, highest = -Infinity;
        try {
          for (const candidate of roots) {
            const noise = jitter.get(candidate);
            const values = scoreOption(state, board, candidate, d - 1, 1, initialTrails, highest - noise, Infinity);
            const value = values[rootActor] + noise;
            if (value > highest) { highest = value; choice = candidate; }
          }
        } catch (error) { if (error !== timeout) throw error; break; }
        best = choice; depth = d;
        if (highest > WIN / 2) break;
      }
    }
    return { action: best.action, depth, nodes, elapsed: performance.now() - start };
  }
  return { LEVELS, evaluate, pawnTrails, choose };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = QuoridorAI;
