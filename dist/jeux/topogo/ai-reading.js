(() => {
  'use strict';

  const node = typeof module === 'object';
  const rules = node ? require('./rules.js') : globalThis.TopogoRules;
  const { BLACK, WHITE, WALL, KOMI, neighbors, groupAt, wallPoints, play } = rules;
  const sign = color => color === BLACK ? 1 : -1;
  const descending = (a, b) => b.rank - a.rank;
  const graphBySize = new Map();
  const unreachable = 999;
  const stone = point => ({ type: 'stone', point });
  const wall = (point, length, orientation) => ({ type: 'wall', point, length, orientation });

  function graphFor(size) {
    if (!graphBySize.has(size)) {
      graphBySize.set(size, Array.from({ length: size * size }, (_, point) => neighbors(point, size)));
    }
    return graphBySize.get(size);
  }

  function distances(board, graph, sources) {
    const distance = new Uint16Array(board.length).fill(unreachable);
    const queue = sources.slice();
    for (const point of queue) distance[point] = 0;
    for (const point of queue) {
      for (const next of graph[point]) {
        if (board[next] || distance[next] !== unreachable) continue;
        distance[next] = distance[point] + 1;
        queue.push(next);
      }
    }
    return distance;
  }

  function ownEye(board, size, graph, point, color) {
    if (graph[point].some(next => board[next] !== color && board[next] !== WALL)) return false;
    const row = Math.floor(point / size), col = point % size;
    let enemies = 0, corners = 0;
    for (const dy of [-1, 1]) for (const dx of [-1, 1]) {
      if (row + dy < 0 || row + dy >= size || col + dx < 0 || col + dx >= size) continue;
      corners++;
      if (board[point + dy * size + dx] === 3 - color) enemies++;
    }
    return enemies < (corners === 4 ? 2 : 1);
  }

  function inspect(game) {
    const { board, size } = game;
    const graph = graphFor(size);
    const groups = [], chain = new Array(board.length);
    const liberties = Array.from(board, () => []);
    const stones = [[], [], []];
    const visited = new Set();
    let blocked = 0;
    for (let point = 0; point < board.length; point++) {
      const color = board[point];
      if (color === WALL) blocked++;
      if (!color || color === WALL) continue;
      stones[color].push(point);
      if (visited.has(point)) continue;
      const group = { ...groupAt(board, size, point, visited), color, eyes: 0 };
      groups.push(group);
      for (const member of group.points) chain[member] = group;
      for (const liberty of group.liberties) {
        liberties[liberty].push(group);
        if (ownEye(board, size, graph, liberty, color)) group.eyes++;
      }
    }

    const distance = [null, distances(board, graph, stones[BLACK]),
      distances(board, graph, stones[WHITE])];
    const owner = new Uint8Array(board.length);
    const seen = new Uint8Array(board.length);
    let territory = 0, settled = 0, influence = 0, danger = 0, contested = 0;
    for (let point = 0; point < board.length; point++) {
      if (board[point] || seen[point]) continue;
      const region = [point], border = new Set();
      seen[point] = 1;
      for (const member of region) {
        for (const group of liberties[member]) border.add(group);
        for (const next of graph[member]) {
          if (board[next] || seen[next]) continue;
          seen[next] = 1;
          region.push(next);
        }
      }
      const boundary = [...border];
      const color = boundary[0]?.color;
      // Do not award the entire outside to the only colour bordering it.
      const sealed = color && region.length <= size * 2 &&
        boundary.every(group => group.color === color && (group.liberties.size > 1 || group.eyes >= 2));
      if (sealed) {
        settled += region.length;
        territory += sign(color) * region.length;
        for (const member of region) owner[member] = color;
      } else if (boundary.length) {
        for (const member of region) {
          const black = distance[BLACK][member], white = distance[WHITE][member];
          if (Math.max(black, white) <= 3) contested++;
          if (Math.min(black, white) > 4) continue;
          const control = Math.max(-3, Math.min(3, white - black)) / 3;
          influence += control / (1 + Math.min(black, white) * .53);
        }
      }
    }

    for (const group of groups) {
      const count = group.liberties.size;
      let risk = count === 1 ? .92 : count === 2 ? .16 : 0;
      if (count === 2 && game.stock[3 - group.color][2]) {
        const [a, b] = group.liberties;
        if (graph[a].includes(b)) {
          group.wallAtari = true;
          risk = .66;
        }
      }
      if (group.eyes >= 2) risk = 0;
      danger -= sign(group.color) * risk * group.points.length;
    }

    const prisoners = game.captures[BLACK] - game.captures[WHITE];
    const stoneBalance = stones[BLACK].length - stones[WHITE].length;
    const occupied = stones[BLACK].length + stones[WHITE].length;
    return {
      graph, groups, chain, liberties, owner, distance, occupied, settled, contested,
      playable: board.length - blocked,
      lead: 1.85 * prisoners - KOMI + territory + .63 * influence + danger + .16 * stoneBalance,
      count: prisoners - KOMI + territory + .33 * influence + danger,
    };
  }

  function openingRank(game, point) {
    const { size } = game;
    const row = Math.floor(point / size), col = point % size;
    const vertical = Math.min(row, size - 1 - row);
    const horizontal = Math.min(col, size - 1 - col);
    const corner = Math.abs(Math.min(vertical, horizontal) - 2.7) +
      .7 * Math.abs(Math.max(vertical, horizontal) - 3.3);
    return 2.5 - .60 * corner - (Math.min(vertical, horizontal) === 0 ? 1.1 : 0);
  }

  function stoneRank(game, info, point) {
    const { turn } = game;
    let rank = .55 * openingRank(game, point);
    const groups = info.liberties[point];
    let allies = 0, enemies = 0, urgent = false;
    for (const group of groups) {
      const count = group.liberties.size;
      const weight = Math.log2(1 + group.points.length);
      const own = group.color === turn;
      if (own) allies++;
      else enemies++;
      if (count === 1) {
        urgent = true;
        rank += own ? 4 + 2 * weight : 8 + 3 * weight;
      } else if (own && group.wallAtari) {
        urgent = true;
        rank += 3 + 2 * weight;
      } else if (!own && count === 2) rank += 2 + weight;
    }
    if (allies > 1) rank += 1.8;
    if (enemies > 1) rank += 1.2;
    const own = info.distance[turn][point], enemy = info.distance[3 - turn][point];
    if (Math.max(own, enemy) <= 3) rank += 1.5;
    if (own === 1 && enemy > 3 && !urgent && allies < 2) rank -= 1.8;
    if (own >= 2 && own <= 4) rank += .65;
    if (info.owner[point] === turn && !urgent) rank -= 9;
    else if (info.owner[point] === 3 - turn && !urgent) rank -= 2;
    return rank;
  }

  function wallRank(game, info, points) {
    const { turn } = game;
    const losses = new Map();
    let rank = points.length === 1 ? -4.7 : -5.7;
    for (const point of points) {
      for (const group of info.liberties[point]) losses.set(group, (losses.get(group) || 0) + 1);
      if (Math.max(info.distance[BLACK][point], info.distance[WHITE][point]) <= 2) rank += 1.3;
      if (info.owner[point] === turn) rank -= 2;
    }
    let threats = 0;
    for (const [group, removed] of losses) {
      const left = group.liberties.size - removed;
      const weight = Math.log2(1 + group.points.length);
      const cost = left === 0 ? 10 + 3 * weight : left === 1 ? 4 + weight : left === 2 ? 1.6 : .25;
      if (group.color === turn) {
        rank -= cost;
      } else {
        rank += cost;
        if (left <= 1) threats++;
      }
    }
    if (threats > 1) rank += 2;
    return rank;
  }

  function wallCandidates(game, point, around) {
    const moves = [];
    if (game.stock[game.turn][1]) moves.push(wall(point, 1, 'horizontal'));
    if (!game.stock[game.turn][2]) return moves;
    moves.push(wall(point, 2, 'horizontal'), wall(point, 2, 'vertical'));
    if (around && point % game.size) moves.push(wall(point - 1, 2, 'horizontal'));
    if (around && point >= game.size) moves.push(wall(point - game.size, 2, 'vertical'));
    return moves;
  }

  function availablePoints(game, move) {
    const points = wallPoints(game.size, move.point, move.length, move.orientation);
    return points.length && points.every(point => !game.board[point]) ? points : null;
  }

  function ranked(game, info, random, includeDistantWalls = true) {
    const stones = [], walls = [];
    const nearStones = point => Math.min(info.distance[BLACK][point], info.distance[WHITE][point]) <= 2;
    for (let point = 0; point < game.board.length; point++) {
      if (game.board[point]) continue;
      stones.push({ move: stone(point), rank: stoneRank(game, info, point) + .42 * random() });
      for (const move of wallCandidates(game, point, false)) {
        const points = availablePoints(game, move);
        if (!points || (!includeDistantWalls && !points.some(nearStones))) continue;
        walls.push({ move, rank: wallRank(game, info, points) + .30 * random() });
      }
    }
    return [stones.sort(descending), walls.sort(descending)];
  }

  function* legal(game, candidates) {
    for (const { move, rank } of candidates) {
      const next = play(game, move).game;
      if (!next) continue;
      let priority = rank;
      if (move.type === 'stone') {
        const { liberties, points } = groupAt(next.board, next.size, move.point);
        const gain = next.captures[game.turn] - game.captures[game.turn];
        if (liberties.size === 1 && gain < points.length) priority -= 3.8 + Math.log2(1 + points.length);
      }
      yield { move, game: next, rank: priority };
    }
  }

  function tactical(game, info, branches) {
    const urgencies = new Map();
    for (const group of info.groups) {
      const count = group.liberties.size;
      if (count > 2 || group.eyes >= 2) continue;
      const importance = count === 1 ? 5 + group.points.length : 1 + group.points.length * .42;
      for (const point of group.liberties) urgencies.set(point, (urgencies.get(point) || 0) + importance);
    }
    const targets = [...urgencies].sort((a, b) => b[1] - a[1]).slice(0, branches + 2);
    const seen = new Set();
    const choices = [];
    for (const [point] of targets) {
      choices.push({ move: stone(point), rank: stoneRank(game, info, point) });
      for (const move of wallCandidates(game, point, true)) {
        const key = move.point * 3 + (move.length === 1 ? 0 : move.orientation === 'horizontal' ? 1 : 2);
        if (seen.has(key)) continue;
        seen.add(key);
        const points = availablePoints(game, move);
        if (!points) continue;
        const rank = wallRank(game, info, points);
        if (rank > 0) choices.push({ move, rank });
      }
    }
    const result = [];
    for (const child of legal(game, choices.sort(descending))) {
      result.push(child);
      if (result.length === branches) break;
    }
    return result;
  }

  const reading = { inspect, ranked, legal, tactical, sign };
  if (node) module.exports = reading;
  else globalThis.TopogoReading = reading;
})();
