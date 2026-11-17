"use strict";

const Quantik = (() => {
  const groups = [];
  for (let i = 0; i < 4; i++) groups.push(15 << (4 * i));
  for (let i = 0; i < 4; i++) groups.push(0x1111 << i);
  groups.push(0x0033, 0x00cc, 0x3300, 0xcc00);
  const at = Array.from({length: 16}, (_, i) => groups.filter(group => group & (1 << i)));
  const blocked = new Uint16Array(65536);
  const counts = new Uint8Array(65536);
  for (let mask = 1; mask < 65536; mask++) {
    const bit = mask & -mask;
    const [row, column, region] = at[31 - Math.clz32(bit)];
    blocked[mask] = blocked[mask ^ bit] | row | column | region;
    counts[mask] = counts[mask ^ bit] + 1;
  }

  function initial(turn = 0) {
    return {pieces: Array(8).fill(0), occupied: 0, turn, ply: 0, last: null, winner: null, lines: [], reason: null};
  }
  function targets(state, side, shape) {
    if (counts[state.pieces[4 * side + shape]] >= 2) return 0;
    return 0xffff & ~(state.occupied | blocked[state.pieces[4 * (1-side) + shape]]);
  }
  function moves(state) {
    const result = [];
    if (state.winner !== null) return result;
    for (let shape = 0; shape < 4; shape++) {
      for (let cells = targets(state, state.turn, shape); cells; cells &= cells - 1) {
        result.push({shape, cell: 31 - Math.clz32(cells & -cells)});
      }
    }
    return result;
  }
  function distinct(pieces, group) {
    for (let i = 0; i < 4; i++) if (!((pieces[i] | pieces[i+4]) & group)) return false;
    return true;
  }
  function play(state, move) {
    if (!move || state.winner !== null) return null;
    const {shape, cell} = move;
    if (!Number.isInteger(shape) || shape < 0 || shape > 3 ||
        !Number.isInteger(cell) || cell < 0 || cell > 15) return null;
    const bit = 1 << cell;
    if (!(targets(state, state.turn, shape) & bit)) return null;
    const turn = 1-state.turn;
    const pieces = state.pieces.slice();
    pieces[4 * state.turn + shape] |= bit;
    const next = {pieces, occupied: state.occupied | bit, turn, ply: state.ply+1,
      last: {shape, cell}, winner: null, reason: null, lines: []};
    for (const group of at[cell]) {
      if ((next.occupied & group) === group && distinct(pieces, group)) next.lines.push(group);
    }
    if (next.lines.length) next.reason = "quartet";
    else if (![0, 1, 2, 3].some(s => targets(next, turn, s))) next.reason = "blocked";
    if (next.reason) next.winner = state.turn;
    return next;
  }
  function pieceAt(state, cell) {
    return state.pieces.findIndex(mask => mask & (1 << cell));
  }
  return {initial, targets, moves, play, pieceAt, groups, counts};
})();

if (typeof module !== "undefined") module.exports = Quantik;
