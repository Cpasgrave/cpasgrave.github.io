(() => {
  'use strict';
  const rules = typeof module === 'object' ? require('./rules.js') : globalThis.GoridorRules;

  function topology(game) {
    const graph = Array.from(game.stones, (_,p) => rules.neighbors(p, game.size, game.edges));
    const groups = [], chain = new Array(graph.length);
    for (let p = 0; p < graph.length; p++) {
      if (!game.stones[p] || chain[p]) continue;
      const group = rules.groupAt(game.stones, game.size, game.edges, p);
      group.color = game.stones[p];
      groups.push(group);
      for (const n of group.points) chain[n] = group;
    }
    return {graph, groups, chain};
  }

  // Benson, "Life in the Game of Go" (1976). Regions may contain opposing stones.
  // Every flood and every vital-point test uses the links that survive the walls.
  function regions(game, board, color) {
    const {graph, chain} = board;
    const seen = new Uint8Array(graph.length), result = [];
    for (let start = 0; start < graph.length; start++) {
      if (seen[start] || game.stones[start] === color) continue;
      const points = [start], empty = [], invaders = [], border = new Set();
      seen[start] = 1;
      for (const p of points) {
        if (game.stones[p]) invaders.push(p);
        else empty.push(p);
        for (const n of graph[p]) {
          if (game.stones[n] === color) border.add(chain[n]);
          else if (!seen[n]) { seen[n] = 1; points.push(n); }
        }
      }
      if (!border.size || !empty.length) continue;
      const vital = [...border].filter(group => empty.every(p => group.liberties.has(p)));
      result.push({color, points, empty, invaders, border, vital});
    }
    return result;
  }

  function profile(game, board = topology(game)) {
    const basins = [...regions(game, board, 1), ...regions(game, board, 2)];
    const alive = new Set(board.groups);
    let viable = basins;
    for (;;) {
      const eyes = new Map();
      for (const region of viable) for (const group of region.vital) {
        eyes.set(group, (eyes.get(group) || 0) + 1);
      }
      const before = alive.size;
      for (const group of alive) if ((eyes.get(group) || 0) < 2) alive.delete(group);
      if (before === alive.size) break;
      viable = viable.filter(region => [...region.border].every(group => alive.has(group)));
    }
    const dead = new Set(), owner = new Uint8Array(game.stones.length), oneEye = new Set();
    for (const region of basins) {
      if (!region.invaders.length && region.border.size === 1) {
        for (const group of region.vital) oneEye.add(group);
      }
      // KataGo's pass-alive territory criterion on a fixed graph. With at most
      // one point off the safe boundary an enclosed opponent cannot make two eyes.
      if (![...region.border].every(group => alive.has(group))) continue;
      let interior = 0;
      for (const p of region.points) {
        if (!board.graph[p].some(n => game.stones[n] === region.color) && ++interior > 1) break;
      }
      if (interior > 1 || region.invaders.some(p => alive.has(board.chain[p]))) continue;
      for (const p of region.points) owner[p] = region.color;
      for (const p of region.invaders) dead.add(p);
    }
    let strength = 0;
    for (const group of board.groups) {
      const sign = group.color === 1 ? 1 : -1;
      const weight = Math.min(8, 1 + Math.sqrt(group.points.length));
      strength += sign * weight * (alive.has(group) ? 1.6 : oneEye.has(group) ? .45 : 0);
    }
    for (const p of dead) strength += game.stones[p] === 2 ? 2 : -2;
    return {board, basins, alive, oneEye, dead, owner, strength};
  }

  // Solve a small enclosed fight with the defender moving first. The surrounding
  // chains have outside liberties. Only the existing walls enter end-of-game reading.
  function readPocket(game, info, region, maxNodes, localKo = false) {
    const {points, empty, invaders, border} = region;
    if (!invaders.length || points.length > 22 || empty.length > 11) return false;
    const members = new Set(points);
    if (![...border].every(g => info.alive.has(g) || [...g.liberties].some(p => !members.has(p)))) return false;
    const index = new Map(points.map((p,i) => [p,i]));
    const all = (1 << points.length) - 1;
    const links = [], around = mask => {
      let adj = 0;
      while (mask) {
        const bit = mask & -mask;
        adj |= links[31 - Math.clz32(bit)];
        mask ^= bit;
      }
      return adj;
    };
    let edge = 0, initial = 0;
    for (const [i,p] of points.entries()) {
      let local = 0;
      for (const n of info.board.graph[p]) {
        if (index.has(n)) local |= 1 << index.get(n);
        else edge |= 1 << i;
      }
      if (game.stones[p]) initial |= 1 << i;
      links.push(local);
    }
    function group(seed, stones) {
      let result = seed, front = seed;
      while (front) {
        front = around(front) & stones & ~result;
        result |= front;
      }
      return result;
    }
    function play(attack, defense, bit, attacking) {
      const own = (attacking ? attack : defense) | bit;
      let other = attacking ? defense : attack;
      const vacant = all & ~(own | other);
      let contact = around(bit) & other;
      while (contact) {
        const touched = group(contact & -contact, other);
        contact &= ~touched;
        if (!attacking && (touched & edge)) continue;
        if (!(around(touched) & vacant)) other &= ~touched;
      }
      const played = group(bit, own);
      const liberties = around(played) & all & ~(own | other);
      if (!liberties && !(attacking && (played & edge))) return null;
      const removed = (attacking ? defense : attack) ^ other;
      // A recapturable single-stone ko is never evidence for killing a group.
      if (!localKo && attacking && removed && !(removed & (removed-1)) && played === bit && !(bit & edge) && liberties === removed) return null;
      const ko = removed && !(removed & (removed-1)) && played === bit && liberties === removed &&
        !(attacking && (played & edge)) ? removed : 0;
      return attacking ? [own, other, ko] : [other, own, ko];
    }
    const memo = new Map();
    let nodes = 0;
    function wins(attack, defense, attacking, depth, forbidden = 0) {
      if (++nodes > maxNodes || !depth) return false;
      if (!defense) {
        // Refuse a snapback that would bring the defender immediately back inside.
        let gaps = all & ~attack & ~forbidden;
        while (gaps) {
          const bit = gaps & -gaps;
          gaps ^= bit;
          const reply = play(attack, 0, bit, false);
          if (reply && reply[0] !== attack) return false;
        }
        return true;
      }
      const positionKey = ((attack * (all + 1) + defense) * 2 + Number(attacking)) * 32 + depth;
      const key = forbidden ? positionKey + '/' + forbidden : positionKey;
      if (memo.has(key)) return memo.get(key);
      const vacant = all & ~(attack | defense | forbidden);
      const near = around(defense) & vacant;
      // Attacker needs only one winning line. Defender can choose every legal
      // placement in the pocket or play elsewhere (the local pass).
      const options = [near, vacant & ~near];
      for (let mask of options) {
        if (!mask) continue;
        while (mask) {
          const bit = mask & -mask;
          mask ^= bit;
          const next = play(attack, defense, bit, attacking);
          if (!next) continue;
          if (wins(next[0], next[1], !attacking, depth-1, localKo ? next[2] : 0) === attacking) {
            memo.set(key, attacking);
            return attacking;
          }
          if (nodes > maxNodes) return false;
        }
      }
      const result = !attacking && wins(attack, defense, true, depth-1);
      memo.set(key, result);
      return result;
    }
    return wins(0, initial, false, Math.min(22, 2*empty.length + 6));
  }

  // Generate a connection or a wall inside an eye space when it leaves two
  // separate vital regions for the same chain on the resulting graph.
  function eyeMoves(game, info) {
    const stones = new Set(), walls = new Set();
    const {graph} = info.board;
    for (const room of info.basins) {
      if (room.color !== game.turn || room.invaders.length || room.border.size !== 1 ||
          room.empty.length < 2 || room.empty.length > 12) continue;
      const [group] = room.border;
      if (info.alive.has(group)) continue;
      const cells = new Set(room.empty);
      function splits(remove, cuts) {
        const seen = new Set();
        let eyes = 0;
        for (const start of cells) {
          if (start === remove || seen.has(start)) continue;
          const region = [start];
          seen.add(start);
          let vital = true;
          for (const p of region) {
            let attached = false;
            for (const n of graph[p]) {
              if (cuts && cuts.some(([a,b]) => (a===p && b===n) || (b===p && a===n))) continue;
              if (n === remove || info.board.chain[n] === group) attached = true;
              else if (cells.has(n) && !seen.has(n)) { seen.add(n); region.push(n); }
            }
            if (!attached) vital = false;
          }
          if (vital && ++eyes === 2) return true;
        }
        return false;
      }
      const slots = new Set();
      for (const p of cells) {
        if (group.liberties.has(p) && splits(p, null)) stones.add(p);
        if (!game.stock[game.turn]) continue;
        for (const n of graph[p]) {
          if (n <= p || !cells.has(n)) continue;
          const horizontal = n-p === game.size;
          for (const origin of [p, p - (horizontal ? 1 : game.size)]) {
            if (origin < 0 || origin % game.size === game.size-1 ||
                origin >= game.size*(game.size-1)) continue;
            const slot = 2*origin + Number(horizontal);
            if (slots.has(slot)) continue;
            slots.add(slot);
            const other = origin + (horizontal ? 1 : game.size);
            const step = horizontal ? game.size : 1;
            if (splits(-1, [[origin,origin+step],[other,other+step]])) walls.add(slot);
          }
        }
      }
    }
    // A wall can also close the mouth of a second eye against open space.
    const tried = new Set();
    for (const group of info.oneEye) {
      if (group.color !== game.turn || info.alive.has(group) || !game.stock[game.turn]) continue;
      for (const p of group.liberties) {
        const leaks = info.board.graph[p].filter(n => info.board.chain[n] !== group);
        if (leaks.length !== 1) continue;
        const n = leaks[0], first = Math.min(n,p), horizontal = Math.abs(n-p) === game.size;
        for (const origin of [first, first-(horizontal ? 1 : game.size)]) {
          if (origin < 0 || origin % game.size === game.size-1 || origin >= game.size*(game.size-1)) continue;
          const slot = 2*origin + Number(horizontal);
          if (tried.has(slot) || walls.has(slot)) continue;
          tried.add(slot);
          const move = {type:'wall', row:Math.floor(origin/game.size), col:origin%game.size,
            orientation:horizontal ? 'horizontal' : 'vertical'};
          const next = rules.play(game, move).game;
          if (!next) continue;
          const after = profile(next);
          if (after.alive.has(after.board.chain[group.points[0]])) walls.add(slot);
        }
      }
    }
    return {stones, walls};
  }

  const api = {topology, profile, readPocket, eyeMoves};
  if (typeof module === 'object') module.exports = api;
  else globalThis.GoridorLife = api;
})();
