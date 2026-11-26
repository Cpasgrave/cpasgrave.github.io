const assert = require('node:assert/strict');
const test = require('node:test');
const { BLACK, WHITE, createGame, play, pass } = require('../dist/jeux/topogo/rules.js');
const { search } = require('../dist/jeux/topogo/monte-carlo.js');
const { count, settings } = require('../dist/jeux/topogo/ai-level.js');
const { caught, inspect } = require('../dist/jeux/topogo/ai-reading.js');
const { groupAt } = require('../dist/jeux/topogo/rules.js');

function seeded() {
  let state = 631122;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function corner(defender) {
  const game = { ...createGame(9), turn: WHITE };
  game.board[0] = defender;
  game.board[9] = defender;
  game.board[18] = 3 - defender;
  return game;
}

test('l’IA prend deux libertés adjacentes d’un coup avec une barrière longue', () => {
  const game = corner(BLACK);
  const move = search(game, { ...settings(3), iterations: 80, budgetMs: Infinity, random: seeded() });
  assert.deepEqual(move, { type: 'wall', point: 1, length: 2, orientation: 'vertical' });
  assert.equal(play(game, move).game.captures[WHITE], 2);
});

test('l’IA sort une chaîne de la menace d’une barrière longue', () => {
  const game = corner(WHITE);
  const move = search(game, { ...settings(3), iterations: 80, budgetMs: Infinity, random: seeded() });
  const next = play(game, move).game;
  assert.equal(next.board[10], WHITE);
  const attack = { type: 'wall', point: 1, length: 2, orientation: 'vertical' };
  assert.equal(play(next, attack).error, 'occupied');
});

test('le niveau augmente les budgets et la recherche visite des coups élargis à plus grande profondeur', () => {
  const profiles = Array.from({ length: count }, (_, index) => settings(index + 1));
  for (const field of ['iterations', 'budgetMs', 'maxDepth']) {
    assert.ok(profiles.every((profile, i) => i === 0 || profile[field] > profiles[i - 1][field]));
  }
  assert.ok(profiles.at(-1).tacticalDepth > profiles[0].tacticalDepth);
  let game = createGame(9);
  for (const point of [20, 31, 39, 40, 29, 22, 49]) game = play(game, { type: 'stone', point }).game;
  const [quick, deeper] = [[1, 300], [3, 2500]].map(([level, iterations]) => {
    let report;
    search(game, { ...settings(level), iterations, budgetMs: Infinity, random: seeded(), onRoot: stats => { report = stats; } });
    assert.equal(report.visits, iterations);
    return report;
  });
  assert.ok(deeper.maxDepth > quick.maxDepth);
  assert.ok(deeper.meanDepth > quick.meanDepth);
  for (const type of ['stone', 'wall']) {
    assert.ok(deeper.moves.some(child => child.move.type === type && child.widened && child.visits));
  }
});

test('en ouverture 19 × 19 la recherche approfondit les suites même avec un budget fixe', () => {
  let game = createGame(19);
  for (const point of [40, 61, 79, 80, 59, 42, 99]) game = play(game, { type: 'stone', point }).game;
  let report;
  const move = search(game, {
    ...settings(5), iterations: 3500, budgetMs: Infinity, random: seeded(),
    onRoot: stats => { report = stats; },
  });
  assert.ok(play(game, move).game);
  assert.ok(report.maxDepth >= 8, 'une ligne atteint au moins huit demi-coups');
  assert.ok(report.meanDepth >= 4, 'la profondeur moyenne progresse aussi');
});

test('les trois formats donnent un coup légal et une position terminée arrête la recherche', () => {
  for (const size of [9, 13, 19]) {
    const game = play(createGame(size), { type: 'stone', point: 2 * size + 2 }).game;
    const move = search(game, { iterations: 35, random: seeded() });
    assert.ok(play(game, move).game);
    assert.equal(search(pass(pass(game))), null);
  }
});

test('le niveau maximal évite une coupe isolée à deux libertés en présence de bons développements', () => {
  let game = createGame(9);
  for (const point of [12, 11, 47, 37, 66, 61, 67, 13, 22, 48, 19]) {
    game = play(game, { type: 'stone', point }).game;
  }
  const isolated = groupAt(play(game, { type: 'stone', point: 21 }).game.board, 9, 21);
  assert.equal(isolated.points.length, 1);
  assert.equal(isolated.liberties.size, 2);
  const move = search(game, { ...settings(5), iterations: 1200, budgetMs: Infinity, random: seeded() });
  assert.equal(move.type, 'stone');
  assert.ok(groupAt(play(game, move).game.board, 9, move.point).liberties.size >= 3);
});

test('la poursuite distingue une capture forcée, une fuite et deux libertés prises par une barrière', () => {
  const game = createGame(9);
  game.board[20] = WHITE;
  for (const p of [11, 19, 28, 12, 39, 48]) game.board[p] = BLACK;
  game.stock[BLACK] = game.stock[WHITE] = { 1: 0, 2: 0 };
  assert.equal(groupAt(game.board, 9, 20).liberties.size, 2);
  assert.equal(caught(game, 20, BLACK, Infinity), true);
  for (const p of [28, 12, 39, 48]) game.board[p] = 0;
  assert.equal(caught(game, 20, BLACK, Infinity), false);
  const wallAttack = { ...corner(WHITE), turn: BLACK };
  assert.equal(caught(wallAttack, 0, BLACK, Infinity), true);
});

test('l’IA sauve le groupe au bord en séparant sa poche de trois points en deux yeux', () => {
  const game = createGame(9);
  for (const [p, cell] of [...'X...XO...XXXXXO...OOOOOO...'].entries()) game.board[p] = '.XO'.indexOf(cell);
  game.stock[BLACK] = { 1: 0, 2: 0 };
  game.stock[WHITE] = { 1: 0, 2: 0 };
  assert.equal(inspect(game).chain[0].eyes, 1);
  const move = search(game, { ...settings(5), iterations: 250, budgetMs: Infinity, random: seeded() });
  assert.deepEqual(move, { type: 'stone', point: 2 });
  assert.equal(inspect(play(game, move).game).chain[0].eyes, 2);
});
