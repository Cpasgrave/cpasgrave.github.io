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

  // Only propose prisoners surrounded by unconditionally living chains. A
  // chain needs two distinct vital regions, each touching it at every empty point.
  function suggestDead(game) {
    const { board, size } = game;
    const graph = Array.from(board, (_, p) => neighbors(p, size));
    const chain = [], groups = [], dead = new Set();
    for (let p = 0; p < board.length; p++) {
      if (board[p] !== BLACK && board[p] !== WHITE || chain[p]) continue;
      const group = groupAt(board, size, p);
      groups.push(group);
      for (const member of group.points) chain[member] = group;
    }
    for (const color of [BLACK, WHITE]) {
      let alive = new Set(groups.filter(g => board[g.points[0]] === color));
      if (!alive.size) continue;
      const seen = new Uint8Array(board.length);
      let rooms = [];
      for (let p = 0; p < board.length; p++) {
        if (seen[p] || board[p] === color || board[p] === WALL) continue;
        const points = [p], empty = [], border = new Set(), invaders = [];
        seen[p] = 1;
        for (const member of points) {
          if (board[member] === EMPTY) empty.push(member);
          else invaders.push(member);
          for (const next of graph[member]) {
            if (board[next] === color) border.add(chain[next]);
            else if (board[next] !== WALL && !seen[next]) {
              seen[next] = 1;
              points.push(next);
            }
          }
        }
        if (!border.size || !empty.length) continue;
        const vital = [...border].filter(g => empty.every(point => g.liberties.has(point)));
        rooms.push({ border, vital, points, invaders });
      }
      for (;;) {
        const eyes = new Map();
        for (const room of rooms) for (const group of room.vital) eyes.set(group, (eyes.get(group) || 0) + 1);
        const previous = alive.size;
        alive = new Set([...alive].filter(g => eyes.get(g) >= 2));
        if (alive.size === previous) break;
        rooms = rooms.filter(room => [...room.border].every(g => alive.has(g)));
      }
      for (const room of rooms) {
        if (!room.invaders.length) continue;
        const interior = room.points.filter(p => !graph[p].some(next => board[next] === color));
        if (interior.length <= 1) for (const prisoner of room.invaders) dead.add(prisoner);
      }
    }
    return dead;
  }

  function score(game, dead = suggestDead(game), flipped = new Set()) {
    const { size } = game;
    const board = game.board.slice();
    const captures = [...game.captures];
    const territory = [0, 0, 0];
    const ownership = new Uint8Array(board.length);
    const regions = new Int16Array(board.length).fill(-1);
    const claimants = new Uint8Array(board.length);
    const living = [0, 0, 0];
    for (const point of dead) {
      const color = board[point];
      if (color !== BLACK && color !== WHITE) continue;
      captures[other(color)]++;
      board[point] = EMPTY;
    }
    for (const color of board) if (color === BLACK || color === WHITE) living[color]++;
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
      if (border.size !== 1) continue;
      const [color] = border;
      claimants[start] = color;
      // Two early passes can leave the whole outside touching just one colour.
      // Leave large, deep open space neutral in the proposal; players can claim it.
      let open = false;
      if (points.length > board.length / 2) {
        let frontier = points.filter(p => neighbors(p, size).some(n => board[n] === color));
        const covered = new Set(frontier);
        for (let i = 0; i < 2; i++) {
          const more = [];
          for (const p of frontier) for (const n of neighbors(p, size)) {
            if (regions[n] !== start || covered.has(n)) continue;
            covered.add(n);
            more.push(n);
          }
          frontier = more;
        }
        open = points.length - covered.size >= size;
      }
      if (open !== flipped.has(start)) continue;
      territory[color] += points.length;
      for (const point of points) ownership[point] = color;
    }
    const totals = [0, territory[BLACK] + captures[BLACK], territory[WHITE] + captures[WHITE] + KOMI];
    return { captures, territory, ownership, regions, claimants, living, totals };
  }

  const rules = { EMPTY, BLACK, WHITE, WALL, KOMI, STOCK, createGame, neighbors, groupAt, wallPoints, play, pass, suggestDead, score };
  if (typeof module === 'object') module.exports = rules;
  else globalThis.TopogoRules = rules;
})();
