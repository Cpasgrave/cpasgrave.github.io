const assert = require('node:assert/strict');
const test = require('node:test');
const { BLACK, WHITE, WALL, KOMI, createGame, play, pass, score, suggestDead } = require('../dist/jeux/topogo/rules.js');

const stone = point => ({ type: 'stone', point });
const wall = (point, length = 1, orientation = 'horizontal') => ({ type: 'wall', point, length, orientation });

function fixture(black, white, walls = []) {
  const game = createGame(9);
  for (const point of black) game.board[point] = BLACK;
  for (const point of white) game.board[point] = WHITE;
  for (const point of walls) game.board[point] = WALL;
  return game;
}

test('réserves indépendantes sur les trois plateaux', () => {
  for (const [size, short, long] of [[9, 1, 1], [13, 1, 2], [19, 0, 4]]) {
    const game = createGame(size);
    assert.deepEqual(game.stock[BLACK], { 1: short, 2: long });
    assert.deepEqual(game.stock[WHITE], game.stock[BLACK]);
    const result = play(game, wall(0, 2)).game;
    assert.equal(result.turn, WHITE);
    assert.equal(result.stock[BLACK][2], long - 1);
    assert.equal(result.stock[WHITE][2], long);
    assert.equal(game.stock[BLACK][2], long);
    assert.equal(game.board[1], 0);
    assert.deepEqual(result.walls[0].points, [0, 1]);
  }
});

test('les deux points sont requis, sans chevauchement ni retour en bord de grille', () => {
  const game = fixture([10], [], [18]);
  assert.equal(play(game, wall(9, 2)).error, 'occupied');
  assert.equal(play(game, wall(19, 2, 'vertical')).game.board[28], WALL);
  assert.equal(play(game, wall(9, 2, 'vertical')).error, 'occupied');
  assert.equal(play(game, wall(8, 2)).error, 'edge');
  assert.equal(play(game, wall(72, 2, 'vertical')).error, 'edge');
  assert.equal(play(game, stone(18)).error, 'occupied');
  assert.equal(play(createGame(19), wall(0)).error, 'stock');
});

test('la barrière longue capture un groupe en prenant simultanément ses deux libertés', () => {
  const game = fixture([18], [0, 9]);
  const result = play(game, wall(1, 2, 'vertical')).game;
  assert.equal(result.board[0], 0);
  assert.equal(result.board[9], 0);
  assert.equal(result.board[1], WALL);
  assert.equal(result.board[10], WALL);
  assert.equal(result.captures[BLACK], 2);
});

test('une petite barrière peut capturer plusieurs groupes mais ne peut pas étouffer un allié', () => {
  const result = play(fixture([9, 3, 11], [0, 2]), wall(1)).game;
  assert.equal(result.captures[BLACK], 2);
  assert.equal(play(fixture([0], [9]), wall(1)).error, 'suicide');
  assert.equal(play(fixture([], [1, 9]), stone(0)).error, 'suicide');
});

test('les pierres obéissent au ko immédiat et les barrières consomment un tour', () => {
  const game = fixture([11, 19, 29], [20, 12, 22, 30]);
  const capture = play(game, stone(21)).game;
  assert.equal(capture.captures[BLACK], 1);
  assert.equal(play(capture, stone(20)).error, 'ko');
  const change = play(capture, wall(70)).game;
  assert.equal(change.turn, BLACK);
  assert.equal(change.stock[WHITE][1], 0);
  assert.equal(change.board[70], WALL);
});

test('les murs délimitent les territoires, les groupes morts et les zones neutres sont révisables', () => {
  const game = fixture([9], [2], [1]);
  const tally = score(game);
  assert.equal(tally.ownership[0], BLACK);
  assert.equal(tally.ownership[1], 0);
  assert.equal(tally.regions[1], -1);
  assert.equal(tally.territory[BLACK], 1);
  assert.equal(tally.totals[WHITE], KOMI);
  assert.equal(score(game, new Set(), new Set([0])).territory[BLACK], 0);
  assert.equal(score(game, new Set([2])).captures[BLACK], 1);
  assert.equal(game.board[2], WHITE);
  assert.equal(score(fixture([], [], [1, 9])).ownership[0], 0);
});

test('deux passes consécutives arrêtent la pose', () => {
  const game = pass(createGame(9));
  assert.equal(play(game, stone(0)).game.passes, 0);
  assert.equal(play(pass(game), wall(0)).error, 'scoring');
  assert.equal(play(pass(game), stone(0)).error, 'scoring');
});

test('dernière blanche capturée : zéro territoire, même si Blanc avait fait des prises', () => {
  for (const size of [9, 13, 19]) {
    let game = createGame(size);
    for (const point of [0, 1, size * size - 1, size]) game = play(game, stone(point)).game;
    assert.equal(game.captures[WHITE], 1);
    for (const point of [2, null, size + 1, null, 0, null, 2 * size]) {
      game = point === null ? pass(game) : play(game, stone(point)).game;
    }
    const result = score(pass(pass(game)));
    assert.equal(result.living[WHITE], 0);
    assert.equal(result.ownership.includes(WHITE), false);
    assert.equal(result.territory[WHITE], 0);
    assert.equal(result.totals[WHITE], 1 + KOMI);
    assert.equal(result.captures[BLACK], 2);
  }
  let game = createGame(9);
  for (const point of [9, 0, 1]) game = play(game, stone(point)).game;
  assert.equal(score(pass(pass(game))).totals[WHITE], KOMI);
});

test('les deux passes laissent les vastes zones ouvertes neutres et révisables', () => {
  const game = pass(pass(fixture([40], [], [0])));
  const result = score(game);
  assert.equal(result.territory[BLACK], 0);
  assert.equal(result.claimants[result.regions[1]], BLACK);
  assert.equal(score(game, new Set(), new Set([result.regions[1]])).territory[BLACK], 79);
  assert.equal(score(game).territory[BLACK], 0);
});

test('un prisonnier entre des groupes vivants est proposé une seule fois et sa marque est réversible', () => {
  const game = createGame(9);
  game.board.fill(BLACK);
  for (const p of [10, 12, 41]) game.board[p] = 0;
  game.board[40] = WHITE;
  game.captures[WHITE] = 3;
  const original = game.board.slice();
  assert.deepEqual([...suggestDead(game)], [40]);
  const result = score(game);
  assert.equal(result.territory[BLACK], 4);
  assert.equal(result.captures[BLACK], 1);
  assert.equal(result.totals[WHITE], 3 + KOMI);
  assert.equal(score(game, new Set()).captures[BLACK], 0);
  assert.deepEqual(score(game), result);
  assert.deepEqual(game.board, original);
  assert.equal(suggestDead(fixture([1, 9], [10])).size, 0);
});

function edgePosition(size, rows, color = BLACK) {
  const game = createGame(size);
  for (const [row, cells] of rows.entries()) for (const [col, cell] of [...cells].entries()) {
    game.board[row * size + col] = { '.': 0, X: color, O: 3 - color, '#': WALL }[cell];
  }
  return pass(pass(game));
}

test('un vrai œil et un faux œil au bord : même avec le premier coup, le groupe enfermé est mort', () => {
  for (const size of [9, 13, 19]) for (const defender of [BLACK, WHITE]) {
    const owner = 3 - defender;
    const game = edgePosition(size, ['O.XXX.XO', 'XXXXOXXO', 'OOOOOOOO'], defender);
    const original = structuredClone(game);
    const dead = suggestDead(game);
    const tally = score(game);
    const defenders = [...game.board.keys()].filter(p => game.board[p] === defender);
    assert.deepEqual(dead, new Set(defenders));
    assert.equal(tally.captures[owner], 10);
    assert.equal(tally.territory[owner], 12);
    assert.equal(tally.ownership[0], 0, 'la pierre de bord adverse encore vivante ne compte pas en territoire');
    assert.equal(tally.territory[defender], 0);
    for (const p of defenders) assert.equal(tally.ownership[p], owner);
    // Allowing the defender to actually take the lone edge stone first still fails.
    const reply = play({ ...game, passes: 0, turn: defender }, stone(1)).game;
    assert.equal(reply.board[0], 0);
    assert.equal(reply.captures[defender], 1);
    assert.equal(suggestDead(reply).size, 11);
    assert.equal(score(game, new Set()).captures[owner], 0);
    assert.equal(score(game, new Set()).ownership[5], 0, 'faux œil ouvert à une capture');
    assert.deepEqual(game, original);
  }
});

test('une connexion, un mur et une reprise en ko peuvent changer le verdict au bord', () => {
  const alive = edgePosition(9, ['O.XXX.XO', 'XXXXXXXO', 'OOOOOOOO']);
  assert.deepEqual(suggestDead(alive), new Set([0]));
  assert.equal(score(alive).territory[BLACK], 3);
  const wall = edgePosition(9, ['.XXX.X#', 'XXXXXX#', '#######']);
  assert.equal(suggestDead(wall).size, 0);
  const counted = score(wall);
  assert.equal(counted.territory[BLACK], 2);
  for (const p of wall.board.keys()) {
    if (wall.board[p] !== 0) assert.equal(counted.ownership[p], 0);
  }
  const ko = edgePosition(9, ['.X.XO', 'XXXOO', 'OOOOO']);
  const take = play({ ...ko, passes: 0, turn: WHITE }, stone(2)).game;
  assert.equal(play(take, stone(3)).error, 'ko');
  assert.equal(suggestDead(ko).size, 0);
  assert.equal(score(ko).ownership[2], 0);
});

test('en séki, les deux yeux privés et la liberté commune restent neutres', () => {
  const game = createGame(9);
  for (const p of game.board.keys()) game.board[p] = p % 9 < 4 ? BLACK : WHITE;
  for (const p of [37, 40, 43]) game.board[p] = 0;
  assert.equal(suggestDead(game).size, 0);
  assert.deepEqual(score(game).territory, [0, 0, 0]);
});

test('les groupes enfermés dans huit à dix libertés sont proposés morts sans sélection manuelle', () => {
  for (const size of [9, 13, 19]) for (const color of [BLACK, WHITE]) for (const width of [4, 5]) {
    for (const barrier of [false, true]) {
      const game = createGame(size);
      game.board.fill(color);
      const invaders = [];
      for (let row = 3; row < 6; row++) for (let col = 2; col < 2 + width; col++) {
        const point = row * size + col;
        game.board[point] = row === 3 ? 3 - color : 0;
        if (row === 3) invaders.push(point);
        if (barrier) game.board[2 * size + col] = WALL;
      }
      for (const point of [size + 1, size + 3]) game.board[point] = 0;
      const original = structuredClone(game);
      assert.deepEqual(suggestDead(game), new Set(invaders));
      const result = score(game);
      assert.equal(result.captures[color], width);
      assert.equal(result.territory[color], width * 3 + 2);
      assert.equal(score(game, new Set()).captures[color], 0);
      assert.deepEqual(game, original);
    }
  }
});

test('deux yeux existants protègent un groupe enfermé, même avec un large espace vide autour', () => {
  const game = createGame(13);
  game.board.fill(BLACK);
  for (let row = 3; row <= 6; row++) for (let col = 2; col <= 7; col++) game.board[row * 13 + col] = 0;
  for (let row = 3; row <= 5; row++) for (let col = 2; col <= 6; col++) game.board[row * 13 + col] = WHITE;
  for (const p of [4 * 13 + 3, 4 * 13 + 5, 14, 16]) game.board[p] = 0;
  assert.equal(suggestDead(game).size, 0);
  assert.equal(score(game).captures[BLACK], 0);
});
