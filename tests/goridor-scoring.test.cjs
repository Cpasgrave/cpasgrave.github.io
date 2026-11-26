'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../dist/jeux/goridor/rules.js');
const life = require('../dist/jeux/goridor/life.js');
const scoring = require('../dist/jeux/goridor/scoring.js');
const ai = require('../dist/jeux/goridor/monte-carlo.js');
const reading = require('../dist/jeux/goridor/lecture.js');

function cornerGame(withBottomWall = true) {
  let game = rules.createGame(9);
  const walls = [[0,1,'horizontal'], [1,3,'horizontal'], [2,0,'horizontal']];
  if (withBottomWall) walls.push([7,4,'vertical']);
  for (const [row,col,orientation] of walls) game = rules.play(game,{type:'wall',row,col,orientation}).game;
  const rows = ['.XXXXOOO.','.OOXXXXXO','O.OOOXXX.','X.XXXXOX.','XXXOX.OOO',
    'XOXOXXOX.','OOOOOXXXX','OOOO..X.O','O..OOX.O.'];
  game.stones = Uint8Array.from(rows.join(''), c => '.XO'.indexOf(c));
  game.captures = [0,3,5];
  return game;
}

test('17 pierres proposées mortes et deux yeux blancs donnant trois points de territoire', () => {
  const game = cornerGame(), before = structuredClone(game);
  const result = scoring.adjudicate(game);
  assert.deepEqual(rules.score(game, []).totals, [0,5,17.5]);
  assert.equal(result.dead.size, 17);
  assert.equal(result.conditional.size, 6);
  for (const p of [10,11,18,20,21,22]) assert.ok(result.conditional.has(p));
  assert.equal(result.uncertain.length, 0);
  assert.deepEqual(result.territory, [0,30,3]);
  assert.deepEqual(result.captures, [0,20,5]);
  assert.deepEqual(result.totals, [0,50,14.5]);
  assert.equal(ai.trainingOutcome(game), null);
  assert.deepEqual(game, before);
  const info = reading.inspect(game);
  assert.equal(scoring.estimate(game, info, result), 35.5);
  const a9 = {type:'stone', row:0, col:0};
  const invade = rules.play({...game, turn:2}, a9).game;
  const answer = rules.play(invade, {type:'stone', row:1, col:0}).game;
  assert.equal(rules.play(answer, a9).error, 'ko');
});

test('la barrière ferme E2, indépendamment de l’œil B1–C1', () => {
  const withWall = life.profile(cornerGame());
  const withoutWall = life.profile(cornerGame(false));
  assert.ok(withWall.alive.has(withWall.board.chain[39]));
  assert.ok(!withoutWall.alive.has(withoutWall.board.chain[39]));

  const playable = cornerGame(false);
  playable.stones[77] = 0; // The wall was installed before F1 was occupied.
  playable.turn = 2;
  const info = reading.inspect(playable);
  assert.ok(life.eyeMoves(playable, info.life).walls.has(2*(7*9+4)));
  const after = rules.play(playable,{type:'wall',row:7,col:4,orientation:'vertical'}).game;
  assert.ok(reading.inspect(after).features[6] < info.features[6]);
  const move = ai.search(playable, {weights:ai.modelWeights(require('../dist/jeux/goridor/modele-9.json')),
    iterations:128, random:() => .5});
  assert.deepEqual(move, {type:'wall', row:7, col:4, orientation:'vertical'});
});

test('séki à une liberté partagée et un œil privé chacun : aucun point de territoire', () => {
  const game = rules.createGame(9);
  game.stones = Uint8Array.from(game.stones, (_,p) => p%9 < 4 ? 1 : 2);
  for (const p of [37,40,43]) game.stones[p] = 0;
  const result = scoring.adjudicate(game);
  assert.equal(result.seki.length, 2);
  assert.equal(result.dead.size, 0);
  assert.deepEqual(result.territory, [0,0,0]);
  assert.deepEqual(result.totals, [0,0,6.5]);
  assert.equal(ai.trainingOutcome(game), -1);
});

test('un territoire ou un groupe peut être corrigé sans modifier la partie ni la proposition initiale', () => {
  const game = cornerGame();
  const first = scoring.adjudicate(game);
  const adjusted = scoring.count(game, first.dead, first.conditional, new Set([first.zones[73].key]));
  assert.equal(adjusted.territory[2], 1);
  assert.equal(first.territory[2], 3);
  const restored = new Set(first.dead);
  for (const p of first.conditional) restored.delete(p);
  const changed = scoring.count(game, restored);
  assert.equal(changed.captures[1], 14);
  assert.equal(first.captures[1], 20);
  assert.deepEqual(scoring.count(game, first.dead).totals, first.totals);
});

test('l’ouverture et les groupes sans verdict ne créent pas un territoire de tout le plateau', () => {
  for (const size of [9,13,19]) {
    const game = rules.play(rules.createGame(size),{type:'stone',row:3,col:3}).game;
    const result = scoring.adjudicate(game);
    assert.equal(result.dead.size, 0);
    assert.equal(result.uncertain.length, 1);
    assert.equal(result.territory[1], 0);
    assert.equal(ai.trainingOutcome(game), null);
  }
});

test('les anciens poids migrent et le septième coefficient apprend la sécurité des formes', () => {
  const weights = [2,1,1,1,.5,.1];
  assert.deepEqual(ai.modelWeights({version:1, size:9, weights}), [...weights,ai.initialWeights[6]]);
  assert.equal(weights.length, 6);
  assert.equal(ai.modelWeights({version:2, size:9, weights}), null);
  assert.equal(ai.inspect(cornerGame()).features.length, 7);
});

test('un faux œil qui permet une capture immédiate reste neutre', () => {
  const game = rules.createGame(9);
  for (const p of [0, 2, 10]) game.stones[p] = 1;
  game.stones[9] = 2;
  assert.equal(rules.score(game, []).ownership[1], 1);
  assert.equal(scoring.count(game, new Set()).ownership[1], 0);
});

test('les deux yeux d’une petite forme vivante ne lui donnent pas tout le dehors', () => {
  const game = rules.createGame(9);
  for (const p of [1, 3, 9, 10, 11, 12]) game.stones[p] = 1;
  const result = scoring.adjudicate(game);
  assert.deepEqual(result.territory, [0,2,0]);
  assert.equal(result.open.size, 1);
  assert.equal(ai.trainingOutcome(game), null);
});
