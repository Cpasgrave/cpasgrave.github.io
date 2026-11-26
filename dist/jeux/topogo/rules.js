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

  // Read an enclosed fight on the agreed topology after two passes. Try every
  // local stone defence (including playing elsewhere) before proposing prisoners.
  function lostPocket(game, room, alive, graph, budget) {
    const { color, points, empty, border } = room;
    if (points.length > 48) return false;
    const cells = new Set(points);
    const boundary = [];
    for (const group of border) {
      const outside = [...group.liberties].filter(p => !cells.has(p));
      if (alive.has(group) || outside.length >= 3) boundary.push(group);
      else if (!outside.length && group.points.length <= 6) {
        // A throw-in trapped inside the pocket can be captured by the defender.
        // Include the intersections it releases and all ensuing recaptures.
        for (const p of group.points) cells.add(p);
      } else return false;
    }
    if (!boundary.length || cells.size > 48) return false;
    // Absorbing a throw-in must not open a connection to another fighting area.
    for (const p of cells) for (const n of graph[p]) {
      if (!cells.has(n) && game.board[n] !== WALL && game.board[n] !== color) return false;
    }
    if (cells.size <= 30) return readLocalPocket(game, cells, color, graph, budget);
    if (empty.length > 7) return false;
    const defender = other(color);
    const memo = new Map(), path = new Set();
    let remaining = Math.min(1200, budget.left);

    function wins(position, depth) {
      if (--remaining < 0 || --budget.left < 0 || !depth) return false;
      const { board, turn } = position;
      const attacking = turn === color;
      const vacant = [], liberties = [], symbols = [];
      for (const p of cells) {
        symbols.push(board[p]);
        if (board[p] !== EMPTY) continue;
        vacant.push(p);
        if (graph[p].some(n => board[n] === defender)) liberties.push(p);
      }
      if (!symbols.includes(defender)) {
        // A recapture even after an outside ko threat keeps the verdict open.
        return !vacant.some(point => {
          const reply = play({ ...position, previousBoard: null, turn: defender }, { type: 'stone', point }).game;
          return reply && reply.captures[defender] > position.captures[defender];
        });
      }
      const key = turn + '/' + symbols.join('');
      if (path.has(key)) return false;
      const entry = key + '/' + depth;
      // A ko is never used as proof. Refuse attacking moves that start one,
      // and let the defender recapture immediately.
      if (memo.has(entry)) return memo.get(entry);
      path.add(key);
      let result = false;
      if (!attacking) {
        result = wins({ ...position, previousBoard: null, turn: color }, depth - 1);
      }
      if (attacking || result) {
        const options = attacking ? liberties : vacant;
        for (const point of options) {
          const next = play(position, { type: 'stone', point }).game;
          if (!next) continue;
          if (attacking && next.captures[color] === position.captures[color] + 1) {
            const captor = groupAt(next.board, game.size, point);
            if (captor.points.length === 1 && captor.liberties.size === 1) continue;
          }
          if (wins({ ...next, previousBoard: null }, depth - 1) === attacking) {
            result = attacking;
            break;
          }
        }
      }
      path.delete(key);
      if (remaining >= 0 && budget.left >= 0) memo.set(entry, result);
      return result;
    }
    return wins({ ...game, turn: defender, passes: 0, previousBoard: null },
      Math.min(18, 2 * (empty.length + cells.size - points.length) + 6));
  }

  function readLocalPocket(game, cells, attacker, graph, budget) {
    const points = [...cells];
    const index = new Map(points.map((point, i) => [point, i]));
    const all = 2 ** points.length - 1;
    const links = points.map(point => graph[point].reduce((mask, next) =>
      index.has(next) ? mask | (1 << index.get(next)) : mask, 0));
    let edge = 0, attack = 0, defense = 0;
    for (const [i, point] of points.entries()) {
      if (graph[point].some(next => !cells.has(next) && game.board[next] === attacker)) edge |= 1 << i;
      if (game.board[point] === attacker) attack |= 1 << i;
      if (game.board[point] === other(attacker)) defense |= 1 << i;
    }
    function adjacent(mask) {
      let result = 0;
      while (mask) {
        const bit = mask & -mask;
        result |= links[31 - Math.clz32(bit)];
        mask ^= bit;
      }
      return result;
    }
    function chain(seed, stones) {
      let connected = seed, front = seed;
      while (front) {
        front = adjacent(front) & stones & ~connected;
        connected |= front;
      }
      return connected;
    }
    function place(own, enemy, bit, attacking) {
      own |= bit;
      let contact = adjacent(bit) & enemy;
      while (contact) {
        const group = chain(contact & -contact, enemy);
        contact &= ~group;
        if (!attacking && (group & edge)) continue;
        if (!(adjacent(group) & all & ~(own | enemy))) enemy &= ~group;
      }
      const group = chain(bit, own);
      if (!(attacking && (group & edge)) && !(adjacent(group) & all & ~(own | enemy))) return null;
      return [own, enemy];
    }
    const memo = new Map(), path = new Set();
    let remaining = Math.min(45000, budget.left);
    function wins(attackers, defenders, attacking, depth) {
      if (--remaining < 0 || --budget.left < 0) return false;
      if (!defenders) {
        let vacant = all & ~attackers;
        while (vacant) {
          const bit = vacant & -vacant;
          vacant ^= bit;
          const recapture = place(0, attackers, bit, false);
          if (recapture && recapture[1] !== attackers) return false;
        }
        return true;
      }
      if (!depth) return false;
      const key = attackers + '/' + defenders + '/' + Number(attacking);
      if (path.has(key)) return false;
      const entry = key + '/' + depth;
      if (memo.has(entry)) return memo.get(entry);
      path.add(key);
      // A defender may play elsewhere. Every legal defence inside the pocket
      // must also lose before the original stones can be proposed dead.
      let result = !attacking && wins(attackers, defenders, true, depth - 1);
      if (attacking || result) {
        const vacant = all & ~(attackers | defenders);
        const near = adjacent(defenders) & vacant;
        for (let options of [near, vacant & ~near]) {
          while (options) {
            const bit = options & -options;
            options ^= bit;
            const next = attacking ? place(attackers, defenders, bit, true) : place(defenders, attackers, bit, false);
            if (!next) continue;
            if (attacking) {
              const removed = defenders ^ next[1];
              const group = chain(bit, next[0]);
              const liberties = adjacent(group) & all & ~(next[0] | next[1]);
              if (removed && !(removed & (removed - 1)) && group === bit && !(bit & edge) && liberties === removed) continue;
            }
            const reply = attacking ? wins(next[0], next[1], false, depth - 1) : wins(next[1], next[0], true, depth - 1);
            if (reply === attacking) {
              result = attacking;
              break;
            }
          }
          if (result === attacking || remaining < 0 || budget.left < 0) break;
        }
      }
      path.delete(key);
      if (remaining >= 0 && budget.left >= 0) memo.set(entry, result);
      return result;
    }
    return wins(attack, defense, false, Math.min(40, 2 * points.length + 6));
  }

  function suggestDead(game) {
    const { board, size } = game;
    const graph = Array.from(board, (_, p) => neighbors(p, size));
    const chain = [], groups = [], dead = new Set();
    const living = new Set(), pockets = [];
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
        const room = { color, border, vital, points, empty, invaders };
        rooms.push(room);
        if (invaders.length) pockets.push(room);
      }
      for (;;) {
        const eyes = new Map();
        for (const room of rooms) for (const group of room.vital) eyes.set(group, (eyes.get(group) || 0) + 1);
        const previous = alive.size;
        alive = new Set([...alive].filter(g => eyes.get(g) >= 2));
        if (alive.size === previous) break;
        rooms = rooms.filter(room => [...room.border].every(g => alive.has(g)));
      }
      for (const group of alive) living.add(group);
      for (const room of rooms) {
        if (!room.invaders.length) continue;
        const interior = room.points.filter(p => !graph[p].some(next => board[next] === color));
        if (interior.length <= 1) for (const prisoner of room.invaders) dead.add(prisoner);
      }
    }
    const budget = { left: 180000 };
    const proposed = [];
    for (const room of pockets.sort((a, b) => a.empty.length - b.empty.length)) {
      if (budget.left <= 0) break;
      if (room.invaders.every(p => dead.has(p)) || room.invaders.some(p => living.has(chain[p]))) continue;
      if (lostPocket(game, room, living, graph, budget)) proposed.push(room);
    }
    const threatened = new Set(proposed.flatMap(room => room.invaders));
    for (const room of proposed) {
      // Opposite proposals depending on each other's capture are unresolved.
      if ([...room.border].some(g => threatened.has(g.points[0]) || dead.has(g.points[0]))) continue;
      for (const p of room.invaders) dead.add(p);
    }
    return dead;
  }

  // A private eye in a seki can be bordered by just one colour. Test the actual
  // exchanges at the shared liberty before assigning either private eye.
  function sharedLifeEye(game, eye, color) {
    const { size, board } = game;
    const around = neighbors(eye, size).filter(p => board[p] !== WALL);
    const group = groupAt(board, size, around[0]);
    if (group.liberties.size !== 2 || !around.every(p => group.points.includes(p))) return false;
    const common = [...group.liberties].find(p => p !== eye);
    const opponent = other(color);
    const adjacent = neighbors(common, size);
    const rival = adjacent.find(p => board[p] === opponent);
    if (rival === undefined) return false;
    const enemy = groupAt(board, size, rival);
    if (enemy.liberties.size !== 2) return false;
    const secondEye = [...enemy.liberties].find(p => p !== common);
    if (!neighbors(secondEye, size).every(p => board[p] === WALL || enemy.points.includes(p))) return false;
    if (!adjacent.every(p => board[p] === WALL || group.points.includes(p) || enemy.points.includes(p))) return false;
    return [[color, eye, group], [opponent, secondEye, enemy]].every(([turn, liberty, chain]) => {
      const attempt = play({ ...game, turn }, { type: 'stone', point: common }).game;
      if (!attempt) return true;
      const reply = play(attempt, { type: 'stone', point: liberty }).game;
      if (!reply || reply.board[chain.points[0]]) return false;
      const captor = groupAt(reply.board, size, liberty);
      if (captor.liberties.size !== 1) return true;
      return !play({ ...reply, previousBoard: null }, { type: 'stone', point: [...captor.liberties][0] }).game;
    });
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
      if (points.length === 1) {
        const opponent = other(color);
        const local = { ...game, board, turn: opponent, previousBoard: null, passes: 0 };
        const invasion = play(local, { type: 'stone', point: start }).game;
        open = Boolean(invasion && invasion.captures[opponent] > game.captures[opponent]) ||
          sharedLifeEye(local, start, color);
      }
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
