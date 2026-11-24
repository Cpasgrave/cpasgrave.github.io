'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../dist/jeux/goridor/rules.js');
const ai = require('../dist/jeux/goridor/monte-carlo.js');
const reading = require('../dist/jeux/goridor/lecture.js');
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
