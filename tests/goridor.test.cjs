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
  assert.equal(game.stock[WHITE], 2);
  const shared = position([[0, 0], [0, 1], [1, 0]], [[0, 2], [2, 0]]);
  const after = play(shared, wall(1, 0, 'vertical')).game;
  assert.deepEqual([...groupAt(after.stones, 9, after.edges, 0).liberties], [10]);
});
