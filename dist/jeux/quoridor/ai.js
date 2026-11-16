"use strict";
const QuoridorAI = (() => {
  const Q = typeof module !== 'undefined' && module.exports ? require('./engine.js') : Quoridor;
  const LEVELS = [null,
    { name: 'Découverte', depth: 1, beam: 2, budget: 25, noise: 1.5 },
    { name: 'Débutant', depth: 1, beam: 3, budget: 45, noise: .65 },
    { name: 'Apprenti', depth: 1, beam: 4, budget: 90, noise: .25 },
    { name: 'Joueur', depth: 2, beam: 4, budget: 180, noise: .08 },
    { name: 'Habitué', depth: 3, beam: 5, budget: 320, noise: 0 },
    { name: 'Stratège', depth: 4, beam: 6, budget: 500, noise: 0 },
    { name: 'Expert', depth: 5, beam: 7, budget: 800, noise: 0 },
    { name: 'Maître', depth: 6, beam: 9, budget: 1200, noise: 0 },
  ];
  function evaluate(state) {
    const n = state.players.length;
    if (state.winner !== null) return state.players.map((_, i) => i === state.winner ? 10000 : -10000);
    const edges = Q.graph(state);
    const distances = state.players.map((_, i) => {
      const walking = Q.distance(state, i, edges);
      // Account for the first legal jump without treating the other pawns as
      // permanent obstacles many turns into the future.
      let nextBest = Infinity;
      for (const to of Q.moves(state, i, undefined, edges)) {
        const next = { ...state, players: state.players.map((p, j) => i === j ? { ...p, position: to } : p) };
        nextBest = Math.min(nextBest, 1 + Q.distance(next, i, edges));
      }
      return Math.min(walking + 1, nextBest);
    });
    const arrivals = distances.map((d, i) => d + ((i - state.turn + n) % n) / n);
    return state.players.map((player, i) => {
      const rivals = arrivals.filter((_, j) => i !== j);
      const nearest = Math.min(...rivals);
      let value = nearest - arrivals[i] + .14 * (player.walls - Math.max(...state.players.filter((_, j) => i !== j).map(p => p.walls)));
      // A rival able to win before our next turn is an immediate tactical loss.
      const threatened = state.players.some((p, j) => j !== i && Q.moves(state, j, undefined, edges).some(to => Q.goalReached(to, p.goal)));
      if (threatened) value -= 35;
      return value;
    });
  }
  function choose(state, level = 3, options = {}) {
    if (state.winner !== null) return { action: null, depth: 0, nodes: 0 };
    const settings = LEVELS[Math.max(1, Math.min(8, Math.round(level)))];
    const rng = options.random || Math.random;
    const start = performance.now(), deadline = start + (options.budget ?? settings.budget);
    const rootPlayer = state.turn;
    let nodes = 0, depthDone = 0;
    const cache = new Map();
    const candidates = (position, isRoot = false) => {
      const hash = Q.key(position);
      if (cache.has(hash)) return cache.get(hash);
      const player = position.turn;
      const moveActions = Q.moves(position).map(to => ({ type: 'move', to }));
      const win = moveActions.find(action => Q.goalReached(action.to, position.players[player].goal));
      if (win) return [{ action: win, state: Q.apply(position, win, false), values: position.players.map((_, i) => i === player ? 10000 : -10000) }];
      // First level explores moves only. Other levels consider every legal wall
      // at the root; pruning applies only after their effects have been scored.
      const actions = settings === LEVELS[1] && moveActions.length ? moveActions : moveActions.concat(Q.legalWalls(position));
      if (!actions.length) actions.push({ type: 'pass' });
      let ranked = actions.map(action => {
        const next = Q.apply(position, action, false), values = evaluate(next);
        nodes++;
        let repeatPenalty = 0;
        if (isRoot && options.history) repeatPenalty = options.history.filter(key => key === Q.key(next)).length * 1.5;
        return { action, state: next, values, rank: values[player] - repeatPenalty };
      }).sort((a, b) => b.rank - a.rank);
      if (isRoot && level >= 3) {
        // In four-player games, never depend on a different rival to stop an
        // immediate win when we can prevent it ourselves this turn.
        const safe = ranked.filter(candidate => {
          const edges = Q.graph(candidate.state);
          return !candidate.state.players.some((p, i) => i !== player && Q.moves(candidate.state, i, undefined, edges).some(to => Q.goalReached(to, p.goal)));
        });
        if (safe.length) ranked = safe;
      }
      const selected = ranked.slice(0, isRoot ? Math.max(5, settings.beam) : settings.beam);
      cache.set(hash, selected);
      return selected;
    };
    const roots = candidates(state, true);
    let best = roots[0];
    if (best.values[rootPlayer] === 10000) return { action: best.action, depth: 1, nodes, elapsed: performance.now() - start };
    const TIMEOUT = Symbol('timeout');
    function search(position, depth) {
      if (performance.now() >= deadline) throw TIMEOUT;
      if (position.winner !== null || !depth) return evaluate(position);
      const actor = position.turn;
      let chosen = null;
      for (const candidate of candidates(position)) {
        const values = search(candidate.state, depth - 1);
        if (!chosen || values[actor] > chosen[actor]) chosen = values;
      }
      return chosen || evaluate(position);
    }
    const maxDepth = state.players.length === 4 ? Math.max(1, settings.depth - 1) : settings.depth;
    for (let depth = 1; depth <= maxDepth; depth++) {
      let iterationBest = null, iterationScore = -Infinity;
      try {
        for (const candidate of roots) {
          const value = depth === 1 ? candidate.rank : search(candidate.state, depth - 1)[rootPlayer];
          const noisy = value + (depth === 1 ? (rng() - .5) * settings.noise : 0);
          if (noisy > iterationScore) { iterationScore = noisy; iterationBest = candidate; }
        }
        best = iterationBest; depthDone = depth;
      } catch (error) { if (error !== TIMEOUT) throw error; break; }
      if (performance.now() >= deadline) break;
    }
    return { action: best.action, depth: depthDone || 1, nodes, elapsed: performance.now() - start };
  }
  return { LEVELS, evaluate, choose };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = QuoridorAI;
