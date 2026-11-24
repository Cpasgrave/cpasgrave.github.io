const test = require('node:test');
const assert = require('node:assert/strict');
const { BLACK, WHITE, createGame, play, groupAt } = require('../dist/jeux/goridor/rules.js');

function position(black, white, turn = BLACK) {
  const game = createGame(9);
  for (const [color, coords] of [[BLACK, black], [WHITE, white]]) {
    for (const [row, col] of coords) game.stones[row * game.size + col] = color;
  }
  game.turn = turn;
  return game;
}

const wall = (row, col, orientation) => ({ type: 'wall', row, col, orientation });

test('les deux joueurs disposent de 2, 4 ou 6 barrières selon le plateau', () => {
  for (const [size, stock] of [[9, 2], [13, 4], [19, 6]]) {
    let game = createGame(size);
    assert.deepEqual(game.stock.slice(1), [stock, stock]);
    for (let index = 0; index < stock; index++) {
      game = play(game, wall(0, 2 * index, 'horizontal')).game;
      game = play(game, wall(2, 2 * index, 'horizontal')).game;
    }
    assert.deepEqual(game.stock.slice(1), [0, 0]);
    assert.equal(play(game, wall(4, 0, 'horizontal')).error, 'stock');
  }
});

test('either segment between occupied points blocks the wall, regardless of color', () => {
  for (const direction of ['horizontal', 'vertical']) {
    for (const segment of [0, 1]) {
      for (const firstColor of [BLACK, WHITE]) {
        for (const secondColor of [BLACK, WHITE]) {
          const game = createGame(9);
          const horizontal = direction === 'horizontal';
          const first = 20 + segment * (horizontal ? 1 : game.size);
          game.stones[first] = firstColor;
          game.stones[first + (horizontal ? game.size : 1)] = secondColor;
          assert.equal(play(game, wall(2, 2, direction)).error, 'betweenStones');
        }
      }
    }
  }
});

test('one or both final liberties of either color are protected; a stone can still capture', () => {
  for (const turn of [BLACK, WHITE]) {
    const single = position([[0, 0]], [[1, 0]], turn);
    assert.equal(play(single, wall(0, 0, 'vertical')).error, 'lastLiberty');
    const pair = position([[0, 0], [0, 1]], [[0, 2]], turn);
    const before = structuredClone(pair);
    assert.equal(play(pair, wall(0, 0, 'horizontal')).error, 'lastLiberty');
    assert.deepEqual(pair, before);
  }
  const single = position([[0, 0]], [[1, 0]], WHITE);
  const { game } = play(single, { type: 'stone', row: 0, col: 1 });
  assert.equal(game.captures[WHITE], 1);
  assert.equal(game.stones[0], 0);
});

test('a wall may leave one liberty, including when a second link reaches the same point', () => {
  const corner = position([[0, 0]], [], WHITE);
  const { game } = play(corner, wall(0, 0, 'vertical'));
  assert.deepEqual([...groupAt(game.stones, 9, game.edges, 0).liberties], [9]);
  assert.deepEqual(game.stones, corner.stones);
  assert.deepEqual(game.captures, corner.captures);
  assert.equal(game.stock[WHITE], corner.stock[WHITE] - 1);
  const shared = position([[0, 0], [0, 1], [1, 0]], [[0, 2], [2, 0]]);
  const after = play(shared, wall(1, 0, 'vertical')).game;
  assert.deepEqual([...groupAt(after.stones, 9, after.edges, 0).liberties], [10]);
});

test('le ko interdit la reprise immédiate et une pierre peut capturer plusieurs chaînes voisines', () => {
  const before = position([[1,2], [2,1], [3,2]], [[2,2], [1,3], [2,4], [3,3]]);
  const capture = play(before, {type:'stone', row:2, col:3}).game;
  assert.equal(capture.captures[BLACK], 1);
  assert.equal(play(capture, {type:'stone', row:2, col:2}).error, 'ko');

  const double = position([[0,1], [0,3], [1,0], [1,4], [2,1], [2,3]], [[1,1], [1,3]]);
  const result = play(double, {type:'stone', row:1, col:2}).game;
  assert.equal(result.captures[BLACK], 2);
  assert.equal(result.stones[10] + result.stones[12], 0);
});
