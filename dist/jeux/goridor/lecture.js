(() => {
  'use strict';
  const rules = typeof module === 'object' ? require('./rules.js') : globalThis.GoridorRules;
  const life = typeof module === 'object' ? require('./life.js') : globalThis.GoridorLife;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const sign = color => color === rules.BLACK ? 1 : -1;

  function distances(game, graph, color) {
    const distance = new Uint16Array(graph.length).fill(999);
    const queue = [];
    for (let p = 0; p < graph.length; p++) {
      if (game.stones[p] === color) { queue.push(p); distance[p] = 0; }
    }
    for (let i = 0; i < queue.length; i++) {
      const point = queue[i];
      for (const next of graph[point]) {
        if (game.stones[next] || distance[next] !== 999) continue;
        distance[next] = distance[point] + 1;
        queue.push(next);
      }
    }
    return distance;
  }

  function inspect(game, cache = new WeakMap()) {
    const { stones, edges, size } = game;
    let graph = cache.get(edges);
    if (!graph) {
      graph = Array.from(stones, (_,p) => rules.neighbors(p, size, edges));
      cache.set(edges, graph);
    }
    const chain = new Array(stones.length);
    const groups = [];
    const visited = new Set();
    const distance = [null, distances(game, graph, 1), distances(game, graph, 2)];
    let material = 0, occupied = 0, pressure = 0, influence = 0, space = 0;
    for (let p = 0; p < stones.length; p++) {
      const color = stones[p];
      if (color) {
        if (chain[p]) continue;
        const group = rules.groupAt(stones, size, edges, p, visited);
        group.color = color;
        for (const member of group.points) chain[member] = group;
        groups.push(group);
        occupied += group.points.length;
        material += sign(color) * group.points.length;
        if (group.liberties.size <= 2) pressure -= sign(color) * group.points.length / group.liberties.size;
      } else {
        const black = distance[1][p], white = distance[2][p];
        influence += Number(black === 1 && white !== 1) - Number(white === 1 && black !== 1);
        const nearest = Math.min(black, white);
        if (nearest <= 4) space += clamp((white - black) * .42, -1, 1) * (1.2 - .2 * nearest);
      }
    }
    // Keep the six inputs of the existing trained evaluator in exactly the same units.
    const features = [(game.captures[1] - game.captures[2] - rules.KOMI) / size,
      material / size, influence / size, pressure / size, (game.stock[1] - game.stock[2]) / 2, 1];
    const board = {graph, groups, chain};
    const safety = life.profile(game, board);
    features.push(safety.strength / size);
    return {...board, distance, features, occupied, space, life:safety};
  }

  function stoneRank(game, info, point) {
    const { graph, chain, distance, occupied } = info;
    const own = game.turn, enemy = 3 - own;
    const around = graph[point];
    const adjacent = [];
    let empty = 0;
    for (const n of around) {
      if (!chain[n]) empty++;
      else if (!adjacent.includes(chain[n])) adjacent.push(chain[n]);
    }
    let capture = 0, rescue = 0, attacks = 0, attackSize = 0, friends = 0, enemies = 0;
    let friendlyLiberties = 0;
    for (const group of adjacent) {
      const libs = group.liberties.size, length = group.points.length;
      if (group.color === own) {
        friends++;
        friendlyLiberties = Math.max(friendlyLiberties, libs - 1);
        if (libs === 1) rescue += length;
      } else {
        enemies++;
        if (libs === 1) capture += length;
        if (libs === 2) { attacks++; attackSize += length; }
      }
    }
    if (!around.length || (!empty && !enemies && !rescue)) return -Infinity;
    if (!capture && !empty && !friendlyLiberties) return -Infinity;
    if (!capture && Math.max(empty, friendlyLiberties) <= 1 && friends < 2 && !rescue) return -8;

    const row = Math.floor(point / game.size), col = point % game.size;
    const line = Math.min(row, col, game.size - 1 - row, game.size - 1 - col);
    const opening = occupied < game.stones.length * .28;
    const desiredLine = game.size === 9 ? 2 : 3;
    const cornerDistance = Math.max(Math.min(row, game.size-1-row), Math.min(col, game.size-1-col));
    const ours = distance[own][point], theirs = distance[enemy][point];
    let rank = opening ? 1.3 - .7 * Math.abs(line - desiredLine)
      - .14 * Math.abs(cornerDistance - desiredLine) : .4 * Math.min(2,line);
    if (opening && ours > 3 && theirs > 2) rank += 1.4;
    if (ours === 2 && theirs <= 3) rank += 1.3;
    if (ours >= 2 && ours <= 4 && theirs >= 2 && theirs <= 4) rank += .8;
    if (friends === 1 && !enemies && theirs > 2) rank -= 1.8;
    if (friends >= 2 && theirs <= 2) rank += 1.6;
    if (enemies >= 2 && ours <= 2) rank += 1.5;
    if (!opening && ours === 1 && theirs >= 4 && !rescue) rank -= 3;
    if (enemies && !friends && empty <= 2) rank -= 1.6;
    rank += capture ? 5 + 2.8 * Math.log2(1 + capture) : 0;
    rank += rescue ? 3 + 2.4 * Math.log2(1 + rescue) : 0;
    if (attacks) rank += 1 + Math.log2(1 + attackSize) + 2.5 * (attacks-1);
    return rank;
  }

  // A liberty is lost only if all links between this chain and this empty point are cut.
  function wallRank(game, info, point, horizontal) {
    const {size, stones, edges, turn} = game;
    const {chain, graph, distance} = info;
    const step = horizontal ? size : 1;
    const second = point + (horizontal ? 1 : size);
    const flag = Number(horizontal);
    if (edges[2*point + flag] || edges[2*second + flag]) return -Infinity;
    const losses = [];
    let separation = 0;
    for (const a of [point, second]) {
      const b = a + step;
      if (stones[a] && stones[b]) return -Infinity;
      if (!stones[a] && !stones[b]) {
        const contrast = p => clamp(distance[3-turn][p] - distance[turn][p], -3, 3);
        if (Math.min(distance[turn][a],distance[3-turn][a]) <= 2) separation += Math.abs(contrast(a)-contrast(b)) * .45;
        continue;
      }
      const empty = stones[a] ? b : a;
      const group = chain[stones[a] ? a : b];
      if (graph[empty].some(n => chain[n] === group && n !== (stones[a] ? a : b))) continue;
      const entry = losses.find(item => item.group === group);
      if (entry) entry.count++;
      else losses.push({group, count:1});
    }
    let rank = -1.8 + separation;
    let threats = 0;
    for (const {group, count} of losses) {
      const remaining = group.liberties.size - count;
      if (!remaining) return -Infinity;
      const danger = remaining === 1 ? 3.6 + Math.log2(1+group.points.length)
        : remaining === 2 ? 1.6 : .2;
      if (group.color === turn) rank -= danger;
      else {
        rank += danger;
        if (remaining === 1) threats++;
      }
    }
    if (threats > 1) rank += 5;
    return rank;
  }

  function ranked(game, info, random) {
    const stones = [], walls = [];
    const eyes = life.eyeMoves(game, info.life);
    const {size} = game;
    // Jitter only breaks similar strategic choices. Clear tactical priorities stay ordered.
    for (let p = 0; p < game.stones.length; p++) {
      const row = Math.floor(p / size), col = p % size;
      if (!game.stones[p]) {
        const rank = stoneRank(game, info, p) + (eyes.stones.has(p) ? 10 : 0);
        if (Number.isFinite(rank)) stones.push({move:{type:'stone', row, col}, rank:rank + .85 * random()});
      }
      if (game.stock[game.turn] && row < size-1 && col < size-1 && info.occupied > 1) {
        for (const horizontal of [false,true]) {
          const rank = wallRank(game, info, p, horizontal) + (eyes.walls.has(2*p+Number(horizontal)) ? 10 : 0);
          if (rank < -.9) continue;
          walls.push({move:{type:'wall', row, col, orientation:horizontal ? 'horizontal' : 'vertical'}, rank:rank + .45*random()});
        }
      }
    }
    const descending = (a,b) => b.rank - a.rank;
    stones.sort(descending);
    walls.sort(descending);
    return {stones, walls};
  }

  // A bounded ladder reader. A proof requires a winning reply to every extension
  // and every adjacent countercapture. Running out of time or nodes gives no bonus.
  function caught(game, anchor, attacker, budget, depth) {
    if (budget.left-- <= 0 || depth === 0 || performance.now() >= budget.until) return false;
    const defender = 3-attacker;
    const chain = rules.groupAt(game.stones, game.size, game.edges, anchor);
    if (chain.liberties.size > 2) return false;
    const attacking = game.turn === attacker;
    const targets = new Set(chain.liberties);
    if (!attacking) {
      const checked = new Set();
      for (const p of chain.points) {
        for (const n of rules.neighbors(p, game.size, game.edges)) {
          if (game.stones[n] !== attacker || checked.has(n)) continue;
          const nearby = rules.groupAt(game.stones, game.size, game.edges, n, checked);
          if (nearby.liberties.size === 1) targets.add(nearby.liberties.values().next().value);
        }
      }
    }
    let replies = 0;
    for (const p of targets) {
      const move = {type:'stone', row:Math.floor(p/game.size), col:p%game.size};
      const next = rules.play(game, move).game;
      if (!next) continue;
      replies++;
      if (!next.stones[anchor]) {
        const captor = rules.groupAt(next.stones, next.size, next.edges, p);
        if (captor.liberties.size === 1) {
          const [liberty] = captor.liberties;
          const takeBack = rules.play(next, {type:'stone', row:Math.floor(liberty/game.size), col:liberty%game.size}).game;
          if (takeBack && takeBack.captures[defender]-next.captures[defender] >= chain.points.length) continue;
        }
        return true;
      }
      const captured = caught(next, anchor, attacker, budget, depth-1);
      if (captured === attacking) return captured;
    }
    if (!attacking && !replies) {
      if (game.passes) return false;
      return caught(rules.pass(game), anchor, attacker, budget, depth-1);
    }
    return !attacking;
  }

  function ladderAdjustment(before, child, info, until) {
    const {move, game} = child;
    if (move.type === 'pass') return 0;
    const actor = before.turn, enemy = 3-actor;
    const p = move.row * game.size + move.col;
    let targets, risk = 0, reward = 0;
    if (move.type === 'stone') {
      const ownChain = info.chain[p];
      if (ownChain.liberties.size <= 2 && caught(game, p, enemy, {left:90, until}, 20)) {
        const gain = game.captures[actor] - before.captures[actor];
        risk = 3.5 * Math.log2(1 + Math.max(0,ownChain.points.length-gain));
      }
      targets = info.graph[p];
    } else {
      targets = [p,p+1,p+game.size,p+game.size+1];
    }
    const checked = new Set();
    for (const n of targets) {
      const chain = info.chain[n];
      if (!chain || chain.color !== enemy || chain.liberties.size !== 1 || checked.has(chain)) continue;
      checked.add(chain);
      if (caught(game, n, actor, {left:90, until}, 20)) reward += 2 + 1.8 * Math.log2(1 + chain.points.length);
    }
    return reward - risk;
  }

  const api = { inspect, ranked, ladderAdjustment };
  if (typeof module === 'object') module.exports = api;
  else globalThis.GoridorReading = api;
})();
