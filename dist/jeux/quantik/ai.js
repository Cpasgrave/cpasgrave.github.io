"use strict";

const QuantikAI = ((game) => {
  const profiles = [
    {random: .85, depth: 1, nodes: 100, ms: 25},
    {random: .32, depth: 1, nodes: 200, ms: 40},
    {random: 0, depth: 1, nodes: 500, ms: 65},
    {random: 0, depth: 2, nodes: 2200, ms: 110},
    {random: 0, depth: 3, nodes: 9000, ms: 210},
    {random: 0, depth: 4, nodes: 30000, ms: 390},
    {random: 0, depth: 6, nodes: 100000, ms: 750},
    {random: 0, depth: 10, nodes: 280000, ms: 1300}
  ];
  const mate = 10000;
  function mobility(state, side) {
    let score = 0;
    for (let shape = 0; shape < 4; shape++) {
      const n = game.counts[game.targets(state, side, shape)];
      score += Math.min(n, 5) * 2 + n;
    }
    return score;
  }
  function evaluate(state) {
    if (state.winner !== null) return -(mate - state.ply);
    return mobility(state, state.turn) - mobility(state, 1-state.turn);
  }
  function shuffled(items, rng) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i+1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
  function choose(state, level, options = {}) {
    const profile = profiles[Math.max(1, Math.min(8, Number(level) || 1)) - 1];
    const rng = options.rng || Math.random;
    const available = shuffled(game.moves(state), rng);
    if (!available.length) return null;
    // All opening squares and shapes are equivalent under the symmetries of the rules.
    if (!state.ply || rng() < profile.random) return available[0];
    let roots = available.map(move => ({move, next: game.play(state, move)}));
    const win = roots.find(root => root.next.winner !== null);
    if (win) return win.move;
    const safe = roots.filter(({next}) =>
      !game.moves(next).some(reply => game.play(next, reply).winner !== null));
    if (safe.length) roots = safe;
    roots.forEach(root => { root.score = -evaluate(root.next); });
    roots.sort((a, b) => b.score - a.score);

    const deadline = performance.now() + Math.min(profile.ms, options.maxMs ?? Infinity);
    let nodes = 0;
    const expired = Symbol();
    const cache = new Map();
    function search(position, depth, alpha, beta) {
      nodes++;
      if (nodes > profile.nodes || ((nodes & 63) === 0 && performance.now() >= deadline)) throw expired;
      if (position.winner !== null || depth === 0) return evaluate(position);
      const key = position.pieces.join("."); // Side to move is fixed by ply in this search.
      const entry = cache.get(key);
      if (entry && entry.depth === depth) {
        if (entry.flag === "exact" || (entry.flag === "lower" && entry.value >= beta) ||
            (entry.flag === "upper" && entry.value <= alpha)) return entry.value;
      }
      const lower = alpha;
      let best = -Infinity;
      const children = [];
      for (const move of game.moves(position)) {
        const child = game.play(position, move);
        if (child.winner !== null) return mate-child.ply;
        children.push({child, score: -evaluate(child)});
      }
      children.sort((a, b) => b.score-a.score);
      for (const {child, score} of children) {
        const value = depth === 1 ? score : -search(child, depth-1, -beta, -alpha);
        best = Math.max(best, value);
        alpha = Math.max(alpha, value);
        if (alpha >= beta) break;
      }
      cache.set(key, {depth, value: best, flag: best <= lower ? "upper" : best >= beta ? "lower" : "exact"});
      return best;
    }
    let chosen = roots[0];
    for (let depth = 2; depth <= Math.min(profile.depth, 16-state.ply); depth++) {
      let best = -Infinity, candidate = chosen;
      try {
        for (const root of roots) {
          const value = -search(root.next, depth-1, -Infinity, -best);
          if (value > best) { best = value; candidate = root; }
        }
      } catch (error) {
        if (error !== expired) throw error;
        break;
      }
      chosen = candidate;
      roots = [chosen, ...roots.filter(root => root !== chosen)];
      if (Math.abs(best) > mate-20 || performance.now() >= deadline) break;
    }
    return chosen.move;
  }
  return {choose};
})(typeof module !== "undefined" && module.exports ? require("./engine.js") : Quantik);

if (typeof module !== "undefined") module.exports = QuantikAI;
