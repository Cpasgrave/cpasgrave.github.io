const assert = require('node:assert/strict');
const test = require('node:test');
const { BLACK, WHITE, createGame, play, pass } = require('../dist/jeux/topogo/rules.js');
const { search } = require('../dist/jeux/topogo/monte-carlo.js');
const { count, settings } = require('../dist/jeux/topogo/ai-level.js');

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
  const [quick, deeper] = [1, 3].map(level => {
    let report;
    search(game, { ...settings(level), budgetMs: Infinity, random: seeded(), onRoot: stats => { report = stats; } });
    assert.equal(report.visits, settings(level).iterations);
    return report;
  });
  assert.ok(deeper.maxDepth > quick.maxDepth);
  for (const type of ['stone', 'wall']) {
    assert.ok(deeper.moves.some(child => child.move.type === type && child.widened && child.visits));
  }
});

test('les trois formats donnent un coup légal et une position terminée arrête la recherche', () => {
  for (const size of [9, 13, 19]) {
    const game = play(createGame(size), { type: 'stone', point: 2 * size + 2 }).game;
    const move = search(game, { iterations: 35, random: seeded() });
    assert.ok(play(game, move).game);
    assert.equal(search(pass(pass(game))), null);
  }
});
