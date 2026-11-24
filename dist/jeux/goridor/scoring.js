(() => {
  'use strict';
  const node = typeof module === 'object';
  const rules = node ? require('./rules.js') : globalThis.GoridorRules;
  const life = node ? require('./life.js') : globalThis.GoridorLife;

  function cleared(game, dead) {
    const stones = game.stones.slice();
    for (const p of dead) stones[p] = 0;
    return {...game, stones, passes:0, previous:null};
  }

  // Two chains with only shared liberties (and possibly a private eye apiece).
  // Check both first moves, including recapture, before neutralising their eyes.
  function mutualLife(game, info) {
    const result = new Set();
    const {board} = info;
    for (const black of board.groups) {
      if (black.color !== 1 || black.liberties.size !== 2 || info.alive.has(black)) continue;
      const nearby = new Set();
      for (const p of black.liberties) for (const n of board.graph[p]) {
        if (game.stones[n] === 2) nearby.add(board.chain[n]);
      }
      for (const white of nearby) {
        if (white.liberties.size !== 2 || info.alive.has(white)) continue;
        const shared = [...black.liberties].filter(p => white.liberties.has(p));
        if (!shared.length) continue;
        const pair = [black, white];
        const isolated = pair.every(g => [...g.liberties].every(p =>
          board.graph[p].every(n => board.chain[n] === g ||
            (shared.includes(p) && pair.includes(board.chain[n])) ||
            (shared.includes(p) && shared.includes(n)))));
        if (!isolated) continue;
        const losesFirst = pair.every(g => [...g.liberties].every(p => {
          const attempt = rules.play({...game, turn:g.color}, stone(p, game.size)).game;
          if (!attempt) return true;
          if (attempt.captures[g.color] !== game.captures[g.color]) return false;
          const own = rules.groupAt(attempt.stones, game.size, game.edges, p);
          if (own.liberties.size !== 1) return false;
          const [liberty] = own.liberties;
          const reply = rules.play(attempt, stone(liberty, game.size)).game;
          if (!reply || reply.stones[g.points[0]]) return false;
          const captor = rules.groupAt(reply.stones, game.size, game.edges, liberty);
          if (captor.liberties.size > 1) return true;
          const [back] = captor.liberties;
          // A ko recapture after an outside threat still leaves this fight open.
          return !rules.play({...reply, previous:null}, stone(back, game.size)).game;
        }));
        if (losesFirst) for (const g of pair) result.add(g);
      }
    }
    return result;
  }

  function stone(point, size) {
    return {type:'stone', row:Math.floor(point/size), col:point%size};
  }

  // A small enclosure can leave the entire outside as a single-colour region.
  // Treat a board-sized space with a deep interior as open to invasion.
  function wideOpen(region, info) {
    if (region.points.length < info.board.graph.length / 2) return false;
    const adjacent = new Set([...region.border].flatMap(group => [...group.liberties]));
    let reach = adjacent;
    for (let i = 0; i < 2; i++) {
      const expanded = new Set(reach);
      for (const p of reach) for (const n of info.board.graph[p]) expanded.add(n);
      reach = expanded;
    }
    return region.empty.some(p => !reach.has(p));
  }

  function standingGroups(info, seki, open) {
    const standing = new Set([...info.alive, ...seki]);
    const rooms = new Map();
    for (const region of info.basins) {
      if (region.invaders.length || region.border.size !== 1 || open.has(region)) continue;
      const [group] = region.border;
      rooms.set(group, (rooms.get(group) || 0) + 1);
    }
    for (const [group, count] of rooms) if (count >= 2) standing.add(group);
    // A chain can join a settled friendly chain at either of two open liberties.
    let before;
    do {
      before = standing.size;
      for (const group of info.board.groups) {
        if (standing.has(group)) continue;
        const links = new Map();
        for (const p of group.liberties) {
          const neighbors = new Set(info.board.graph[p].map(n => info.board.chain[n]));
          for (const ally of neighbors) if (standing.has(ally) && !seki.has(ally) && ally.color === group.color) {
            links.set(ally, (links.get(ally) || 0) + 1);
          }
        }
        if ([...links.values()].some(n => n >= 2)) standing.add(group);
      }
    } while (standing.size !== before);
    return standing;
  }

  function suggest(game) {
    const info = life.profile(game);
    const dead = new Set(info.dead), conditional = new Set();
    const seki = mutualLife({...game, passes:0, previous:null}, info);
    const proposals = [];
    for (const region of info.basins) {
      if (!region.invaders.length || region.invaders.every(p => dead.has(p))) continue;
      if (region.invaders.some(p => info.alive.has(info.board.chain[p]) || seki.has(info.board.chain[p]))) continue;
      const strict = life.readPocket(game, info, region, 40000);
      if (strict || life.readPocket(game, info, region, 40000, true)) proposals.push({region, strict});
    }
    const threatened = new Set(proposals.flatMap(({region}) => region.invaders));
    for (const {region, strict} of proposals) {
      // Mutually dependent kills require agreement; never erase both sides of a race.
      if ([...region.border].some(g => threatened.has(g.points[0]) || dead.has(g.points[0]))) continue;
      for (const p of region.invaders) {
        dead.add(p);
        if (!strict) conditional.add(p);
      }
    }
    return {dead, conditional};
  }

  function count(game, dead, conditional = new Set(), flipped = new Set()) {
    const result = rules.score(game, dead);
    const clean = cleared(game, dead);
    const info = life.profile(clean);
    const open = new Set(info.basins.filter(region => !region.invaders.length && wideOpen(region, info)));
    const seki = mutualLife(clean, info), standing = standingGroups(info, seki, open);
    const uncertain = info.board.groups.filter(g => !standing.has(g));
    const zones = new Array(game.stones.length);
    for (const region of info.basins) {
      if (region.invaders.length) continue;
      const {color, points, border} = region;
      if (!result.ownership[points[0]]) continue;
      const unclaimed = ![...border].some(g => standing.has(g)) && points.length > 2;
      let neutral = unclaimed || open.has(region) || [...border].some(g => seki.has(g));
      if (points.length === 1 && border.size > 1 && [...border].some(g => g.liberties.size === 1)) {
        const invasion = rules.play({...clean, turn:3-color}, stone(points[0], game.size)).game;
        if (invasion && invasion.captures[3-color] > clean.captures[3-color]) neutral = true;
      }
      const key = color + ':' + points.join(',');
      region.key = key;
      for (const p of points) zones[p] = region;
      if (flipped.has(key)) { neutral = !neutral; open.delete(region); }
      if (neutral) {
        for (const p of points) result.ownership[p] = 0;
        result.territory[color] -= points.length;
        result.totals[color] -= points.length;
      }
    }
    return {...result, uncertain, seki:[...seki], conditional, zones, flipped, open};
  }

  function adjudicate(game) {
    const {dead, conditional} = suggest(game);
    return {...count(game, dead, conditional), dead};
  }

  // The live estimate apportions open intersections fractionally by distance
  // through the remaining edges. Only territory and prisoners enter the lead.
  function estimate(game, info, settlement) {
    let lead = game.captures[1] - game.captures[2] - rules.KOMI;
    if (settlement) lead = settlement.captures[1]-settlement.captures[2]-rules.KOMI;
    const safety = info.life;
    for (let p = 0; p < game.stones.length; p++) {
      if (settlement) {
        const owner = settlement.ownership[p];
        if (owner) { lead += owner === 1 ? 1 : -1; continue; }
        if ((settlement.zones[p] && !settlement.open.has(settlement.zones[p])) || settlement.dead.has(p)) continue;
      }
      if (!settlement && safety.dead.has(p)) { lead += game.stones[p] === 2 ? 2 : -2; continue; }
      if (game.stones[p]) continue;
      if (safety.owner[p]) { lead += safety.owner[p] === 1 ? 1 : -1; continue; }
      const black = info.distance[1][p], white = info.distance[2][p];
      const near = Math.min(black, white);
      if (near <= 4) lead += Math.max(-1, Math.min(1, (white-black)*.36)) * (1.12-.22*near);
    }
    return lead;
  }

  const api = {suggest, count, adjudicate, estimate};
  if (node) module.exports = api;
  else globalThis.GoridorScoring = api;
})();
