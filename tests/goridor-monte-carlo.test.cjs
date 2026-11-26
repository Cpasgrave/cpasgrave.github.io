'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../dist/jeux/goridor/rules.js');
const ai = require('../dist/jeux/goridor/monte-carlo.js');
const reading = require('../dist/jeux/goridor/lecture.js');
const levels = require('../dist/jeux/goridor/ai-level.js');
function seeded(seed) {
  return () => ((seed = (Math.imul(seed,1664525) + 1013904223) >>> 0) / 4294967296);
}

test('les deux couleurs trouvent une capture de deux pierres en atari', () => {
  for (const color of [1,2]) {
    const game = rules.createGame(9);
    game.turn = color;
    for (const p of [30,32,39,41,49]) game.stones[p] = color;
    game.stones[31] = game.stones[40] = 3 - color;
    const move = ai.search(game, {random:seeded(27), iterations:60});
    assert.equal(rules.play(game,move).game.captures[color], 2);
    assert.equal(game.stones[40],3-color);
  }
});

test('la recherche respecte les trois tailles et les états terminaux', () => {
  for (const size of [9,13,19]) {
    const random = seeded(80);
    let game = rules.createGame(size);
    game = rules.play(game,{ type:'wall',row:2,col:3,orientation:'vertical' }).game;
    for (let i=0;i<8;i++) {
      const move = ai.search(game,{random,iterations:4});
      game = move.type === 'pass' ? rules.pass(game) : rules.play(game,move).game;
      assert.ok(game);
    }
    assert.equal(ai.search(rules.pass(rules.pass(game))), null);
  }
});

test('une barrière menace deux chaînes que deux pierres différentes devraient attaquer', () => {
  for (const attacker of [1, 2]) {
    const game = rules.play(rules.createGame(9), {type:'wall', row:3, col:4, orientation:'vertical'}).game;
    game.turn = attacker;
    for (const p of [31, 32]) game.stones[p] = attacker;
    for (const p of [40, 41]) game.stones[p] = 3 - attacker;
    const move = ai.search(game, {random:seeded(17), iterations:160});
    assert.deepEqual(move, {type:'wall', row:4, col:4, orientation:'horizontal'});
    const after = rules.play(game, move).game;
    assert.deepEqual(after.captures, game.captures);
    for (const p of [40, 41]) assert.equal(rules.groupAt(after.stones, 9, after.edges, p).liberties.size, 1);
  }
});

test('le moteur sauve une chaîne en atari et reconnaît une prise en retour perdante', () => {
  const escape = rules.createGame(9);
  for (const p of [10, 11, 12]) escape.stones[p] = 1;
  for (const p of [1, 2, 3, 9, 19, 20, 21]) escape.stones[p] = 2;
  assert.deepEqual(ai.search(escape, {random:seeded(5), iterations:160}), {type:'stone', row:1, col:4});

  const trap = rules.createGame(9);
  for (const p of [9, 10]) trap.stones[p] = 1;
  for (const p of [0, 2, 11, 18, 19]) trap.stones[p] = 2;
  const bait = {type:'stone', row:0, col:1};
  const tempting = rules.play(trap, bait).game;
  const reply = rules.play(tempting, {type:'stone', row:0, col:0}).game;
  assert.deepEqual(reply.captures, [0, 1, 3]);
  assert.notDeepEqual(ai.search(trap, {random:seeded(5), iterations:160}), bait);
});

test('une seconde passe ferme une position gagnante au score', () => {
  const game = rules.createGame(9);
  // Three chains, each enclosing two private eyes in the middle row of its strip.
  for (const [start, color] of [[0,1], [27,2], [54,1]]) {
    for (let p=start; p<start+27; p++) game.stones[p] = color;
    game.stones[start+11] = game.stones[start+15] = 0;
  }
  game.captures[1] = 20;
  game.turn = 2;
  const once = rules.pass(game);
  const move = ai.search(once, {random:seeded(31), iterations:120});
  assert.equal(move.type, 'pass');
});

test('une deuxième passe gagne immédiatement quand le score est établi, même sur un plateau vide', () => {
  const once = rules.pass(rules.createGame(9));
  const after = rules.pass(once);
  assert.equal(ai.trainingOutcome(after), -1);
  let report;
  assert.deepEqual(ai.search(once, {budgetMs:0, onRoot(value) { report = value; }}), {type:'pass'});
  assert.equal(report.visits, 0);
});

test('un score incertain après deux passes ne vaut pas une victoire certaine pour la recherche', () => {
  const start = rules.createGame(9);
  const drawn = rules.play(start, {type:'stone', row:2, col:2}).game;
  drawn.captures = [0,0,50];
  const after = rules.pass(rules.pass(drawn));
  assert.equal(ai.trainingOutcome(after), null);
  assert.ok(ai.terminal(after) < 0);
  assert.ok(ai.terminal(after) >= -.5);
});

test('les cinq niveaux augmentent le temps alloué et les plus hauts lisent un coup tactique de plus', () => {
  const profiles = Array.from({length:levels.count}, (_, index) => levels.settings(index + 1));
  assert.equal(profiles.length, 5);
  assert.ok(profiles.every(({budgetMs}, index) => !index || budgetMs > profiles[index-1].budgetMs));
  assert.ok(profiles.at(-1).rollout > profiles[0].rollout);
  assert.equal(levels.settings(0), levels.settings(levels.defaultLevel));
  assert.equal(levels.settings(undefined), levels.settings(levels.defaultLevel));
});

test('une pierre de soutien sur la diagonale brise la lecture du shichō', () => {
  const game = rules.createGame(9);
  for (const p of [31, 39, 32]) game.stones[p] = 1;
  game.stones[40] = 2;
  const move = {type:'stone', row:5, col:4};
  function ladder(before) {
    const after = rules.play(before, move).game;
    return reading.ladderAdjustment(before, {move, game:after}, reading.inspect(after), Infinity);
  }
  assert.ok(ladder(game) > 0);
  const supported = structuredClone(game);
  supported.stones[60] = 2;
  assert.equal(ladder(supported), 0);
});

function moveKey(move) {
  return [move.type, move.row, move.col, move.orientation].join('/');
}

test('la réserve couvre exactement les coups légaux écartés par le classement initial', () => {
  const first = rules.play(rules.createGame(9), {type:'wall', row:1, col:1, orientation:'vertical'}).game;
  const base = rules.play(first, {type:'wall', row:6, col:6, orientation:'horizontal'}).game;
  for (const p of [31, 39, 41, 49]) base.stones[p] = 1;
  base.stones[30] = 2;
  for (const stock of [base.stock, [0, 0, 1]]) {
    const game = {...base, stock};
    const before = structuredClone(game);
    const info = reading.inspect(game);
    const pool = reading.ranked(game, info, seeded(8));
    const preferred = new Set([...pool.stones, ...pool.walls].map(({move}) => moveKey(move)));
    const expected = new Set();
    for (let row=0; row<game.size; row++) for (let col=0; col<game.size; col++) {
      for (const move of [{type:'stone', row, col}, {type:'wall', row, col, orientation:'horizontal'},
        {type:'wall', row, col, orientation:'vertical'}]) {
        const key = moveKey(move);
        if (!preferred.has(key) && rules.play(game, move).game) expected.add(key);
      }
    }
    const keys = [];
    for (const child of reading.reserve(game, info, pool, seeded(12))) {
      keys.push(moveKey(child.move));
      assert.deepEqual(child.game, rules.play(game, child.move).game);
    }
    assert.equal(keys.length, expected.size);
    assert.deepEqual(new Set(keys), expected);
    assert.ok(expected.has(moveKey({type:'stone', row:4, col:4})));
    assert.equal(keys.some(key => key.startsWith('wall/')), Boolean(stock[game.turn]));
    assert.deepEqual(game, before);
  }
});

test('le budget supplémentaire permet de visiter des pierres et des barrières hors présélection', () => {
  const first = rules.play(rules.createGame(9), {type:'stone', row:2, col:2}).game;
  const game = rules.play(first, {type:'stone', row:6, col:6}).game;
  const before = structuredClone(game);
  const pool = reading.ranked(game, reading.inspect(game), seeded(14));
  assert.equal(pool.walls.length, 0);
  function run(iterations, widening) {
    let report;
    const played = ai.search(game, {iterations, width:4, rollout:1, random:seeded(14), widening,
      onRoot(summary) { report = summary; }});
    assert.equal(report.visits, iterations);
    assert.equal(report.moves.reduce((sum, child) => sum+child.visits, 0), iterations);
    const keys = report.moves.map(({move}) => moveKey(move));
    assert.equal(keys.length, new Set(keys).size);
    assert.ok(keys.includes(moveKey(played)));
    for (const {move} of report.moves) assert.ok(rules.play(game, move).game);
    return report.moves;
  }
  assert.deepEqual(run(3, true), run(3, false));
  const fixed = run(160, false);
  const extra = run(160).filter(child => child.widened);
  assert.ok(extra.some(({move}) => move.type === 'stone'));
  assert.ok(extra.some(({move}) => move.type === 'wall'));
  const initial = new Set(fixed.map(({move}) => moveKey(move)));
  for (const {move, visits} of extra) {
    assert.ok(visits > 0);
    assert.ok(!initial.has(moveKey(move)));
  }
  assert.deepEqual(game, before);
});
