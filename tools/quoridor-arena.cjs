// Compare two Quoridor engines on identical openings, exchanging seats.
// node tools/quoridor-arena.cjs path/to/previous/ai.js players budgetMs openingCount [firstOpening] [solo]
'use strict';
const path = require('node:path');
const Q = require('../dist/jeux/quoridor/engine.js');
const current = require('../dist/jeux/quoridor/ai.js');
const [previousFile, playersArg = '2', budgetArg = '1200', openingsArg = '4', firstArg = '0', lineup = 'paired'] = process.argv.slice(2);
const count = Number(playersArg), budget = Number(budgetArg), openings = Number(openingsArg), first = Number(firstArg);
if (!previousFile || ![2, 4].includes(count) || !Number.isInteger(budget) || budget < 1 ||
    !Number.isInteger(openings) || openings < 1 || !Number.isInteger(first) || first < 0 ||
    !['paired', 'solo'].includes(lineup)) {
  throw Error('Expected previous AI file, 2 or 4 players, milliseconds, opening count and optional starting index.');
}
const previous = require(path.resolve(previousFile));

function opening(index) {
  let state = Q.createGame(count, index % count), seed = 37 + index;
  function pick(list) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return list[Math.floor(seed / 4294967296 * list.length)];
  }
  const history = [];
  // Opening zero is the regular start. Others mix forward steps, lateral
  // steps and legal central walls. Both engines receive exactly the same state.
  for (let turn = 0; index && turn < count + 2 * (index % 4); turn++) {
    const actor = state.turn;
    let action;
    if ((turn + index) % 4 === 0) {
      const central = Q.legalWalls(state).filter(w => w.r > 1 && w.r < 6 && w.c > 1 && w.c < 6);
      if (central.length) action = pick(central);
    }
    if (!action) {
      const legal = Q.moves(state).map(to => ({ type: 'move', to }));
      const distance = move => Q.distance(Q.apply(state, move), actor);
      const best = Math.min(...legal.map(distance));
      action = pick(legal.filter(a => distance(a) <= best + (index + turn) % 2));
    }
    history.push(state);
    state = Q.apply(state, action);
  }
  return { state, history };
}
for (let index = first; index < first + openings; index++) {
  const start = opening(index);
  let rotations = count === 2 ? [[0], [1]] : [[0,2], [1,3], [0,1], [2,3]];
  if (count === 4 && lineup === 'solo') {
    const all = [0, 1, 2, 3];
    rotations = all.flatMap(i => [[i], all.filter(seat => seat !== i)]);
  }
  for (const seats of rotations) {
    let state = start.state;
    const history = start.history.slice();
    while (state.winner === null && history.length < 240) {
      const engine = seats.includes(state.turn) ? current : previous;
      const trails = engine.pawnTrails(state, history.slice(-32));
      const { action } = engine.choose(state, 8, { budget, trails });
      history.push(state);
      state = Q.apply(state, action);
    }
    console.log(JSON.stringify({ index, count, budget, seats, plies: history.length,
      winner: state.winner, result: state.winner === null ? 'draw' : seats.includes(state.winner) ? 'new' : 'old' }));
  }
}
