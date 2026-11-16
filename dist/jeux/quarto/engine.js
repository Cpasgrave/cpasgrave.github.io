(function (root) {
  "use strict";
  const LINES = [];
  for (let i = 0; i < 4; i++) {
    LINES.push([4*i,4*i+1,4*i+2,4*i+3], [i,i+4,i+8,i+12]);
  }
  LINES.push([0,5,10,15], [3,6,9,12]);
  const LEVELS = [
    { name: "Découverte", depth: 1, nodes: 200, timeMs: 80, random: .65, description: "Des choix variés et des erreurs volontaires pour découvrir le jeu." },
    { name: "Débutant", depth: 1, nodes: 500, timeMs: 100, random: .25, description: "Repère des gains simples, avec encore quelques erreurs." },
    { name: "Prudent", depth: 2, nodes: 1200, timeMs: 160, random: 0, description: "Saisit les gains immédiats et évite d’offrir une pièce gagnante si possible." },
    { name: "Intermédiaire", depth: 3, nodes: 3500, timeMs: 300, random: 0, description: "Anticipe la pose et le choix de pièce suivants." },
    { name: "Confirmé", depth: 4, nodes: 9000, timeMs: 500, random: 0, description: "Recherche les pièges sur plusieurs actions." },
    { name: "Avancé", depth: 5, nodes: 20000, timeMs: 800, random: 0, description: "Approfondit les choix de pièces et les réponses adverses." },
    { name: "Difficile", depth: 6, nodes: 45000, timeMs: 1200, random: 0, description: "Explore davantage de suites avant de se décider." },
    { name: "Expert", depth: 8, nodes: 90000, timeMs: 1800, random: 0, description: "Recherche maximale, jusqu’à 8 actions et environ 1,8 seconde." },
  ];
  // The four bits encode colour, height, shape and hole, matching the original images.
  function winningLine(board) {
    return LINES.find(line => {
      const pieces = line.map(index => board[index]);
      return pieces.every(piece => piece !== null) &&
        ((pieces.reduce((a,b) => a & b, 15) | pieces.reduce((a,b) => a & (b ^ 15), 15)) !== 0);
    }) || null;
  }
  function initialState(first = 0) {
    return { board: Array(16).fill(null), remaining: Array.from({length:16}, (_,i)=>i),
      pending: null, turn: first, phase: "choose", winner: null, line: null };
  }
  function legalActions(state) {
    if (state.phase === "over") return [];
    if (state.phase === "choose") return state.remaining.map(piece => ({ piece }));
    return state.board.flatMap((piece, cell) => piece === null ? [{ cell }] : []);
  }
  function applyAction(state, action) {
    if (!action || state.phase === "over") return null;
    if (state.phase === "choose") {
      if (!state.remaining.includes(action.piece)) return null;
      return { ...state, remaining: state.remaining.filter(piece => piece !== action.piece),
        pending: action.piece, phase: "place", turn: 1 - state.turn };
    }
    if (!Number.isInteger(action.cell) || action.cell < 0 || action.cell > 15 ||
        state.board[action.cell] !== null || state.pending === null) return null;
    const board = state.board.slice();
    board[action.cell] = state.pending;
    const line = winningLine(board);
    const over = Boolean(line) || state.remaining.length === 0;
    return { ...state, board, pending: null, line, phase: over ? "over" : "choose",
      winner: line ? state.turn : null };
  }
  function winningCells(board, piece) {
    const result = [];
    for (let cell = 0; cell < 16; cell++) {
      if (board[cell] !== null) continue;
      const copy = board.slice();
      copy[cell] = piece;
      if (winningLine(copy)) result.push(cell);
    }
    return result;
  }
  function safePieces(state) {
    return state.remaining.filter(piece => !winningCells(state.board, piece).length);
  }
  function evaluate(state, pov) {
    if (state.phase === "over") return state.winner === null ? 0 : state.winner === pov ? 10000 : -10000;
    let score = 0;
    if (state.phase === "place" && winningCells(state.board, state.pending).length) score = 9000;
    if (state.phase === "choose" && !safePieces(state).length) score = -9000;
    return state.turn === pov ? score : -score;
  }
  function chooseAction(state, level = 3, options = {}) {
    const profile = LEVELS[Math.max(0, Math.min(7, Math.round(level)-1))];
    const rng = options.rng || Math.random;
    const pick = list => list[Math.floor(rng()*list.length)];
    let actions = legalActions(state);
    if (!actions.length) return { action: null, depth: 0, nodes: 0 };
    if (profile.random && rng() < profile.random) return { action: pick(actions), depth: 0, nodes: 0 };
    if (state.phase === "place") {
      const wins = winningCells(state.board, state.pending);
      if (wins.length) return { action: { cell: pick(wins) }, depth: 1, nodes: 0 };
    }
    const scored = actions.map(action => ({ action, score: evaluate(applyAction(state, action), state.turn) }));
    const topScore = Math.max(...scored.map(item=>item.score));
    if (level >= 3) actions = scored.filter(item=>item.score===topScore).map(item=>item.action);
    let chosen = pick(scored.filter(item=>item.score===topScore)).action;
    const deadline = performance.now() + (options.timeMs ?? profile.timeMs);
    const nodeLimit = options.nodes ?? profile.nodes;
    let nodes = 0;
    let completedDepth = 0;
    const interrupted = Symbol("interrupted");
    function search(position, depth, alpha, beta) {
      if (++nodes > nodeLimit || performance.now() > deadline) throw interrupted;
      if (!depth || position.phase === "over") return evaluate(position, state.turn);
      const maximizing = position.turn === state.turn;
      let best = maximizing ? -Infinity : Infinity;
      for (const action of legalActions(position)) {
        const value = search(applyAction(position, action), depth-1, alpha, beta);
        best = maximizing ? Math.max(best, value) : Math.min(best, value);
        if (maximizing) alpha = Math.max(alpha, best);
        else beta = Math.min(beta, best);
        if (alpha >= beta) break;
      }
      return best;
    }
    for (let depth = 1; depth <= profile.depth; depth++) {
      try {
        const results = actions.map(action => ({
          action, score: search(applyAction(state, action), depth-1, -Infinity, Infinity),
        }));
        const best = Math.max(...results.map(result=>result.score));
        chosen = pick(results.filter(result=>result.score===best)).action;
        completedDepth = depth;
        if (Math.abs(best) >= 10000) break;
      } catch (error) {
        if (error !== interrupted) throw error;
        break;
      }
    }
    return { action: chosen, depth: completedDepth, nodes };
  }
  const api = { LINES, LEVELS, initialState, winningLine, legalActions, applyAction, winningCells, safePieces, chooseAction };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Quarto = api;
})(globalThis);
