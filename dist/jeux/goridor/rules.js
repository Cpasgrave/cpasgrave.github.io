(() => {
  'use strict';

  const BLACK = 1;
  const WHITE = 2;
  const STOCK = Object.freeze({ 9: 2, 13: 4, 19: 6 });
  const KOMI = 6.5;
  const other = player => 3 - player;

  function createGame(size) {
    if (!Object.hasOwn(STOCK, size)) throw new RangeError('Taille de plateau invalide');
    return {
      size,
      stones: new Uint8Array(size * size),
      edges: new Uint8Array(size * size * 2),
      walls: [],
      stock: [0, STOCK[size], STOCK[size]],
      captures: [0, 0, 0],
      turn: BLACK,
      previous: null,
      lastStone: null,
      lastWall: null,
      passes: 0,
    };
  }

  function neighbors(point, size, edges) {
    const result = [];
    const col = point % size;
    if (col > 0 && !edges[(point - 1) * 2]) result.push(point - 1);
    if (col < size - 1 && !edges[point * 2]) result.push(point + 1);
    if (point >= size && !edges[(point - size) * 2 + 1]) result.push(point - size);
    if (point < size * (size - 1) && !edges[point * 2 + 1]) result.push(point + size);
    return result;
  }

  function groupAt(stones, size, edges, start, visited = new Set()) {
    const color = stones[start];
    const points = [start];
    const liberties = new Set();
    visited.add(start);
    for (const point of points) {
      for (const next of neighbors(point, size, edges)) {
        if (stones[next] === 0) {
          liberties.add(next);
        } else if (stones[next] === color && !visited.has(next)) {
          points.push(next);
          visited.add(next);
        }
      }
    }
    return { points, liberties };
  }

  function groupsWithoutLiberties(stones, size, edges, color) {
    const visited = new Set();
    const captured = [];
    for (let point = 0; point < stones.length; point++) {
      if (stones[point] !== color || visited.has(point)) continue;
      const group = groupAt(stones, size, edges, point, visited);
      if (group.liberties.size === 0) captured.push(...group.points);
    }
    return captured;
  }

  function inBounds(row, col, size) {
    return Number.isInteger(row) && Number.isInteger(col) &&
      row >= 0 && col >= 0 && row < size && col < size;
  }

  function play(game, move) {
    if (game.passes >= 2) return { error: 'finished' };
    const { size, turn } = game;
    const { type, row, col, orientation } = move;
    const stones = game.stones.slice();
    let edges = game.edges;
    let walls = game.walls;
    let lastStone = game.lastStone;
    let lastWall = null;
    const stock = [...game.stock];
    const captures = [...game.captures];
    const point = row * size + col;

    if (type === 'stone') {
      if (!inBounds(row, col, size)) return { error: 'bounds' };
      if (stones[point]) return { error: 'occupied' };
      stones[point] = turn;
      lastStone = point;
      const removed = groupsWithoutLiberties(stones, size, edges, other(turn));
      for (const captured of removed) stones[captured] = 0;
      if (groupsWithoutLiberties(stones, size, edges, turn).length) {
        return { error: 'suicide' };
      }
      captures[turn] += removed.length;
    } else if (type === 'wall') {
      if (!stock[turn]) return { error: 'stock' };
      if (!inBounds(row, col, size - 1)) return { error: 'edge' };
      if (orientation !== 'horizontal' && orientation !== 'vertical') {
        return { error: 'orientation' };
      }
      const horizontal = orientation === 'horizontal';
      const beside = point + (horizontal ? 1 : size);
      const across = horizontal ? size : 1;
      const firstEdge = point * 2 + Number(horizontal);
      const secondEdge = beside * 2 + Number(horizontal);
      if (edges[firstEdge] || edges[secondEdge]) return { error: 'overlap' };
      if (walls.some(wall => wall.row === row && wall.col === col)) {
        return { error: 'crossing' };
      }
      if ((stones[point] && stones[point + across]) ||
          (stones[beside] && stones[beside + across])) {
        return { error: 'betweenStones' };
      }
      edges = edges.slice();
      edges[firstEdge] = 1;
      edges[secondEdge] = 1;
      // Only groups touching one of the two severed links can lose a liberty.
      for (const end of [point, point + across, beside, beside + across]) {
        if (stones[end] && !groupAt(stones, size, edges, end).liberties.size) {
          return { error: 'lastLiberty' };
        }
      }
      lastWall = { row, col, orientation };
      walls = [...walls, lastWall];
      stock[turn]--;
    } else {
      return { error: 'move' };
    }

    const { previous } = game;
    if (previous && stones.every((stone, index) => stone === previous.stones[index]) &&
        edges.every((edge, index) => edge === previous.edges[index])) {
      return { error: 'ko' };
    }

    return {
      game: {
        ...game, stones, edges, walls, stock, captures,
        lastStone: lastStone !== null && stones[lastStone] ? lastStone : null,
        lastWall,
        previous: { stones: game.stones, edges: game.edges },
        turn: other(turn),
        passes: 0,
      },
    };
  }

  function pass(game) {
    if (game.passes >= 2) return game;
    return {
      ...game,
      turn: other(game.turn),
      passes: game.passes + 1,
      lastWall: null,
      previous: { stones: game.stones, edges: game.edges },
    };
  }

  function score(game, dead) {
    const { size, edges } = game;
    const stones = game.stones.slice();
    const captures = [...game.captures];
    const territory = [0, 0, 0];
    const ownership = new Uint8Array(stones.length);
    const visited = new Set();
    for (const point of dead) {
      if (stones[point]) {
        captures[other(stones[point])]++;
        stones[point] = 0;
      }
    }
    for (let start = 0; start < stones.length; start++) {
      if (stones[start] || visited.has(start)) continue;
      const region = [start];
      const borders = new Set();
      visited.add(start);
      for (const point of region) {
        for (const next of neighbors(point, size, edges)) {
          if (stones[next]) {
            borders.add(stones[next]);
          } else if (!visited.has(next)) {
            region.push(next);
            visited.add(next);
          }
        }
      }
      if (borders.size !== 1) continue;
      const [color] = borders;
      territory[color] += region.length;
      for (const point of region) ownership[point] = color;
    }
    const totals = [0, territory[BLACK] + captures[BLACK], territory[WHITE] + captures[WHITE] + KOMI];
    return { captures, territory, ownership, totals };
  }

  const rules = { BLACK, WHITE, STOCK, KOMI, createGame, play, pass, score, groupAt };
  if (typeof module === 'object') module.exports = rules;
  else window.GoridorRules = rules;
})();
