(() => {
  'use strict';

  const EMPTY = 0, BLACK = 1, WHITE = 2, WALL = 3;
  const KOMI = 6.5;
  const STOCK = Object.freeze({
    9: Object.freeze({ 1: 1, 2: 1 }),
    13: Object.freeze({ 1: 1, 2: 2 }),
    19: Object.freeze({ 1: 0, 2: 4 }),
  });
  const other = player => 3 - player;

  function createGame(size) {
    if (!Number.isInteger(size) || !Object.hasOwn(STOCK, size)) throw new RangeError('Taille inconnue');
    return {
      size,
      board: new Uint8Array(size * size),
      walls: [],
      stock: [null, { ...STOCK[size] }, { ...STOCK[size] }],
      captures: [0, 0, 0],
      turn: BLACK,
      passes: 0,
      previousBoard: null,
      lastMove: null,
    };
  }

  function neighbors(point, size) {
    const points = [];
    if (point % size > 0) points.push(point - 1);
    if (point % size < size - 1) points.push(point + 1);
    if (point >= size) points.push(point - size);
    if (point < size * (size - 1)) points.push(point + size);
    return points;
  }

  function groupAt(board, size, start, visited = new Set()) {
    const color = board[start];
    const points = [start];
    const liberties = new Set();
    visited.add(start);
    for (const point of points) {
      for (const next of neighbors(point, size)) {
        if (board[next] === EMPTY) liberties.add(next);
        if (board[next] !== color || visited.has(next)) continue;
        visited.add(next);
        points.push(next);
      }
    }
    return { points, liberties };
  }

  function wallPoints(size, point, length, orientation) {
    if (length === 1) return [point];
    if (length !== 2) return [];
    if (orientation === 'horizontal' && point % size < size - 1) return [point, point + 1];
    if (orientation === 'vertical' && point < size * (size - 1)) return [point, point + size];
    return [];
  }

  function play(game, move) {
    if (game.passes >= 2) return { error: 'scoring' };
    const { size, turn } = game;
    const { type, point, length, orientation } = move;
    const isWall = type === 'wall';
    if (type !== 'stone' && !isWall) return { error: 'move' };
    if (!Number.isInteger(point) || point < 0 || point >= game.board.length) return { error: 'edge' };
    if (isWall && !game.stock[turn][length]) return { error: 'stock' };
    const points = isWall ? wallPoints(size, point, length, orientation) : [point];
    if (!points.length) return { error: 'edge' };
    if (points.some(index => game.board[index] !== EMPTY)) return { error: 'occupied' };

    const board = game.board.slice();
    for (const index of points) board[index] = isWall ? WALL : turn;
    const affected = new Set(points.flatMap(index => neighbors(index, size)));
    if (!isWall) affected.add(point);

    // Test all neighbouring enemy groups before removing any of them.
    const checked = new Set();
    const captured = [];
    for (const index of affected) {
      if (board[index] !== other(turn) || checked.has(index)) continue;
      const group = groupAt(board, size, index, checked);
      if (!group.liberties.size) captured.push(...group.points);
    }
    for (const index of captured) board[index] = EMPTY;

    checked.clear();
    for (const index of affected) {
      if (board[index] !== turn || checked.has(index)) continue;
      if (!groupAt(board, size, index, checked).liberties.size) return { error: 'suicide' };
    }
    if (game.previousBoard && board.every((cell, index) => cell === game.previousBoard[index])) {
      return { error: 'ko' };
    }

    const lastMove = isWall
      ? { type, point, length, orientation, points, player: turn }
      : { type, point, player: turn };
    const stock = [...game.stock];
    if (isWall) stock[turn] = { ...stock[turn], [length]: stock[turn][length] - 1 };
    const captures = [...game.captures];
    captures[turn] += captured.length;
    return {
      game: {
        ...game, board, stock, captures, lastMove,
        walls: isWall ? [...game.walls, lastMove] : game.walls,
        turn: other(turn), passes: 0, previousBoard: game.board,
      },
    };
  }

  function pass(game) {
    if (game.passes >= 2) return game;
    return {
      ...game,
      turn: other(game.turn),
      passes: game.passes + 1,
      previousBoard: game.board,
      lastMove: { type: 'pass', player: game.turn },
    };
  }

  function score(game, dead = new Set(), neutral = new Set()) {
    const { size } = game;
    const board = game.board.slice();
    const captures = [...game.captures];
    const territory = [0, 0, 0];
    const ownership = new Uint8Array(board.length);
    const regions = new Int16Array(board.length).fill(-1);
    for (const point of dead) {
      const color = board[point];
      if (color !== BLACK && color !== WHITE) continue;
      captures[other(color)]++;
      board[point] = EMPTY;
    }
    for (let start = 0; start < board.length; start++) {
      if (board[start] !== EMPTY || regions[start] !== -1) continue;
      const points = [start];
      const border = new Set();
      regions[start] = start;
      for (const point of points) {
        for (const next of neighbors(point, size)) {
          if (board[next] === WALL) continue;
          if (board[next] !== EMPTY) {
            border.add(board[next]);
          } else if (regions[next] === -1) {
            regions[next] = start;
            points.push(next);
          }
        }
      }
      if (border.size !== 1 || neutral.has(start)) continue;
      const [color] = border;
      territory[color] += points.length;
      for (const point of points) ownership[point] = color;
    }
    const totals = [0, territory[BLACK] + captures[BLACK], territory[WHITE] + captures[WHITE] + KOMI];
    return { captures, territory, ownership, regions, totals };
  }

  const rules = { EMPTY, BLACK, WHITE, WALL, KOMI, STOCK, createGame, neighbors, groupAt, wallPoints, play, pass, score };
  if (typeof module === 'object') module.exports = rules;
  else globalThis.TopogoRules = rules;
})();
