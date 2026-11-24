'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../dist/jeux/goridor/rules.js');
const ai = require('../dist/jeux/goridor/monte-carlo.js');
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
