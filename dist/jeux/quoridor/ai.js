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
    // A reserve buys future turns only while the race is still open. The last
    // wall also buys the option of answering a threat anywhere on the board.
    const horizon = Math.min(1, Math.min(...arrivals) / 4);
    const totalWalls = state.players.reduce((total, p) => total + p.walls, 0);
    const strength = state.players.map((p, i) => {
      const stock = .72 * p.walls + .75 * Math.min(p.walls, 2) + (p.walls ? 1.15 : 0);
      const opposingWalls = totalWalls - p.walls;
      const exposure = Math.log2(1 + opposingWalls);
      const field = board.fields[i], here = field[p.position];
      // A choice of forward routes makes it harder for one wall to seal
      // the next step. Look at the actual legal exits, including jumps.
      const exits = moves[i].filter(to => field[to] < here).length;
      const risk = exposure * (exits > 1 ? .16 : .32);
      return -arrivals[i] + horizon * (stock - risk);
    });
    if (count === 2) {
      const margin = strength[0] - strength[1];
      return { moves, immediate, scores: [margin, -margin] };
    }
    const scores = strength.map((own, i) => {
      // Rank opponents by time to finish, including seat order. Explicitly
      // value the second and third rival as well: a single wall may slow two.
      const rivals = [0, 1, 2, 3].filter(j => i !== j).sort((a, b) => arrivals[a] - arrivals[b]);
      const [leader, second, third] = rivals;
      // A continuous blend near a tie avoids abrupt score changes when
      // players exchange the lead. Stocks affect power separately from ETA.
      const margin = arrivals[leader] - arrivals[i];
      const gap = j => Math.min(4, arrivals[j] - arrivals[leader]);
      const raceLead = margin + .28 * gap(second) + .14 * gap(third);
      const rivalPower = Math.max(...rivals.map(j => strength[j]));
      return .58 * raceLead + .50 * (own - rivalPower) + .35 * own;
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
    return .07 * progress - repetition;
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
  function replyWalls(state, board, fullRoutes) {
    const ids = new Set(), occupied = new Set(state.players.map(p => p.position));
    for (const [i, p] of state.players.entries()) {
      if (i === state.turn) continue;
      const field = board.fields[i], from = p.position;
      // A wall that lengthens the walking distance must cut EVERY shortest
      // route, so it must cut this one too. Two wall slots can cover each edge.
      // This includes remote bottlenecks while keeping the reply set small.
      if (fullRoutes) {
        let here = from;
        while (field[here] > 0) {
          const next = board.edges[here].find(to => to >= 0 && field[to] < field[here]);
          wallsAcross(here, next, ids);
          here = next;
        }
      }
      for (const next of board.edges[from]) {
        if (next < 0) continue;
        if (field[next] < field[from]) {
          wallsAcross(from, next, ids);
          // Also consider a barrier one step ahead, before the opponent
          // reaches a junction or can secure it with a crossing wall.
          for (const after of board.edges[next]) {
            if (after >= 0 && field[after] < field[next]) wallsAcross(next, after, ids);
          }
        }
        if (occupied.has(next)) {
          wallsAcross(from, next, ids);
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

    function exposedRoutes(parent, board, destinations) {
      const actor = parent.turn, field = board.fields[actor];
      const risks = new Map(destinations.map(to => [to, 0]));
      const threats = [];
      const rivals = parent.players.map((_, i) => i).filter(i => i !== actor && parent.players[i].walls);
      if (!rivals.length) return { risks, threats };
      for (const wall of WALLS) {
        if (Q.wallError(parent, wall, rivals[0], false)) continue;
        const after = boardWithWall({ ...parent, walls: [...parent.walls, wall] });
        if (parent.players.some((p, i) => i !== actor && after.fields[i][p.position] === UNREACHABLE)) continue;
        const cost = Math.min(...rivals.map(i => {
          const from = parent.players[i].position;
          return after.fields[i][from] - board.fields[i][from];
        }));
        for (const to of destinations) {
          const remaining = after.fields[actor][to];
          if (remaining === UNREACHABLE) continue;
          const delay = remaining - field[to] - cost;
          risks.set(to, Math.max(risks.get(to), delay));
          if (to === parent.players[actor].position && delay >= 2) threats.push({ wall, delay, blocker: rivals[0] });
        }
      }
      threats.sort((a, b) => b.delay - a.delay);
      return { risks, threats };
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
      // With an empty reserve the race is compulsory, even in a forced loss.
      // Compare the remaining walk after the currently legal step or jump.
      // Other pawns may move before the next turn; walls are permanent.
      const field = board.fields[actor];
      const shortest = pawn.walls ? Infinity : moves.reduce((best, to) => Math.min(best, field[to]), Infinity);
      const destinations = moves.filter(to => field[to] <= shortest);
      // When two shortest routes tie, test what one actual legal enemy wall
      // could do to either route. No opposing stock means no wall exposure.
      const assessExposure = (!duel && level >= 6 && pawn.walls > 0) ||
        (!pawn.walls && level >= 4 && destinations.length > 1);
      const exposure = atRoot && assessExposure ? exposedRoutes(parent, board, [pawn.position, ...destinations]) : null;
      const currentRisk = exposure?.risks.get(pawn.position) ?? 0;
      for (const to of destinations) {
        const action = { type: 'move', to };
        const next = Q.apply(parent, action, false);
        let bias = moveBias(board, parent, to, trails);
        if (exposure) {
          const risk = exposure.risks.get(to);
          bias += pawn.walls ? .36 * (Math.min(8, currentRisk) - Math.min(8, risk)) : -.3 * risk;
        }
        if (atRoot && previousPositions.size && previousPositions.has(Q.key(next))) bias -= 1.5;
        add(action, next, board, bias);
      }
      if (pawn.walls && (level > 1 || !moves.length)) {
        const placements = atRoot || !moves.length ? WALLS : replyWalls(parent, board, level >= 6);
        for (const wall of placements) {
          if (!atRoot) checkTime();
          if (Q.wallError(parent, wall, actor, false)) continue;
          const next = Q.apply(parent, wall, false), geometry = boardWithWall(next);
          if (next.players.some((p, i) => geometry.fields[i][p.position] === UNREACHABLE)) continue;
          // A defensive wall can secure a corridor by occupying or crossing
          // the very slot an opponent needs to close its exit.
          let protection = 0;
          if (exposure?.threats.length) {
            const stillOpen = exposure.threats.find(t => !Q.wallError(next, t.wall, t.blocker, false));
            protection = Math.max(0, Math.min(8, currentRisk) - Math.min(8, stillOpen?.delay ?? 1));
          }
          add(wall, next, geometry, .36 * protection);
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
      if (!duel && level >= 6) {
        const wall = safe.find(c => c.action.type === 'wall');
        if (wall && wall.rank >= safe[0].rank - 2 && !selected.some(c => c.action.type === 'wall')) {
          selected[selected.length - 1] = wall;
        }
      }
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
      if (!remaining) {
        // The next seat moves before anyone can intervene. A winning step
        // at the search horizon is just as certain as one inside the tree.
        if (child.info.immediate[child.state.turn]) {
          return terminal({ ...child.state, winner: child.state.turn }, child.board, ply + 1);
        }
        return child.info.scores;
      }
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
    if (roots.length > 1 && best.state.winner === null) {
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
        roots.splice(roots.indexOf(best), 1);
        roots.unshift(best);
        if (highest > WIN / 2) break;
      }
    }
    return { action: best.action, depth, nodes, elapsed: performance.now() - start };
  }
  return { LEVELS, evaluate, pawnTrails, choose };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = QuoridorAI;
