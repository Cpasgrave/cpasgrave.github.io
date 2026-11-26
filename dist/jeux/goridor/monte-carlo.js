(() => {
  'use strict';
  const node = typeof module === 'object';
  const rules = node ? require('./rules.js') : globalThis.GoridorRules;
  const reading = node ? require('./lecture.js') : globalThis.GoridorReading;
  const scoring = node ? require('./scoring.js') : globalThis.GoridorScoring;
  const initialWeights = [1.8, 1.5, 1.0, 1.4, .28, .18, .95];
  const side = game => game.turn === 1 ? 1 : -1;

  function estimate(features, weights) {
    return Math.tanh(features.reduce((sum, x, i) => sum + x * weights[i], 0) / 3);
  }

  function modelWeights(model) {
    if (!model || model.size !== 9 || !Array.isArray(model.weights) || !model.weights.every(Number.isFinite)) return null;
    if (model.version === 1 && model.weights.length === 6) return [...model.weights, initialWeights[6]];
    return model.version === 2 && model.weights.length === 7 ? model.weights : null;
  }

  const endings = new WeakMap();
  function ending(game) {
    let result = endings.get(game);
    if (!result) {
      result = scoring.adjudicate(game);
      endings.set(game, result);
    }
    return result;
  }

  function outcome(result) {
    if (result.uncertain.length || result.conditional.size || result.open.size) return null;
    return Math.sign(result.totals[1] - result.totals[2]);
  }

  function terminal(game) {
    const result = ending(game);
    // An unresolved count can guide search, with less weight than a confirmed outcome.
    return outcome(result) ?? .5 * Math.tanh((result.totals[1]-result.totals[2]) / game.size);
  }

  function value(game, info, weights) {
    const lead = scoring.estimate(game, info);
    return .70 * estimate(info.features, weights) + .30 * Math.tanh(lead / (2*game.size));
  }

  function takeLastLiberty(game, group) {
    if (group.liberties.size !== 1) return null;
    const [p] = group.liberties;
    const move = {type:'stone', row:Math.floor(p/game.size), col:p%game.size};
    const next = rules.play(game, move).game;
    return next ? {next, point:p, gain:next.captures[game.turn] - game.captures[game.turn]} : null;
  }

  function* legalChildren(game, info, candidates) {
    for (const candidate of candidates) {
      const {move, rank} = candidate;
      const p = move.row * game.size + move.col;
      if (move.type === 'stone' && info.life.owner[p] === game.turn && rank < 5) continue;
      const next = candidate.game ?? rules.play(game, move).game;
      if (!next) continue;
      let priority = rank;
      if (move.type === 'stone') {
        const group = rules.groupAt(next.stones, next.size, next.edges, p);
        const gain = next.captures[game.turn] - game.captures[game.turn];
        if (group.liberties.size === 1) {
          const reply = takeLastLiberty(next, group);
          if (reply) {
            const capturingChain = rules.groupAt(reply.next.stones, game.size, game.edges, reply.point);
            const recapture = takeLastLiberty(reply.next, capturingChain);
            const trade = gain - reply.gain + (recapture?.gain ?? 0);
            if (trade < 0 && !gain) continue;
            if (trade < 0) priority = Math.min(priority, trade - 2);
            if (trade > gain) priority += 2 + Math.log2(1 + trade);
          }
        }
      }
      yield {move, game:next, rank:priority};
    }
  }

  function* extraChoices(stones, walls, reserve) {
    // Keep an independent turn for moves missed by the heuristic cutoffs.
    const streams = [reserve, stones, walls];
    while (streams.length) {
      const stream = streams.shift();
      const candidate = stream.next();
      if (candidate.done) continue;
      streams.push(stream);
      yield candidate.value;
    }
  }

  function choices(game, info, random, width, widening) {
    const pool = reading.ranked(game, info, random);
    const stones = legalChildren(game, info, pool.stones);
    const walls = legalChildren(game, info, pool.walls);
    const children = [];
    for (const [moves, limit] of [[stones, width], [walls, Math.max(2, Math.ceil(width / 3))]]) {
      for (let i = 0; i < limit; i++) {
        const candidate = moves.next();
        if (candidate.done) break;
        children.push(candidate.value);
      }
    }
    const late = info.occupied > game.stones.length * .48;
    if (!children.length || late || game.passes === 1) {
      const winningPass = game.passes === 1 && outcome(ending(game)) === side(game);
      children.push({move:{type:'pass'}, game:rules.pass(game), rank:winningPass ? 25 : -1.4});
    }
    const extra = widening ? extraChoices(stones, walls,
      legalChildren(game, info, reading.reserve(game, info, pool, random))) : null;
    return {children:children.sort((a,b) => b.rank - a.rank), extra};
  }

  // Read alternating forcing replies to a quiet evaluation. A chain can sometimes
  // be saved by capturing a different chain, so all ataris on the board participate.
  function read(game, info, weights, cache, depth, deadline) {
    let best = value(game, info, weights);
    if (!depth) return best;
    const targets = new Map();
    for (const group of info.groups) {
      if (group.liberties.size !== 1) continue;
      const [p] = group.liberties;
      targets.set(p, (targets.get(p) || 0) + group.points.length);
    }
    const order = [...targets].sort((a,b) => b[1] - a[1]).slice(0, 4);
    const sense = side(game);
    for (const [p] of order) {
      if (performance.now() >= deadline) break;
      const next = rules.play(game, {type:'stone',row:Math.floor(p/game.size),col:p%game.size}).game;
      if (!next) continue;
      const reply = read(next, reading.inspect(next, cache), weights, cache, depth-1, deadline);
      if (sense * reply > sense * best) best = reply;
    }
    return best;
  }

  // PUCT uses tactical priors to allocate simulations. Root moves also receive
  // a tactical reading whose depth depends on the selected level.
  function search(game, {weights = initialWeights, random = Math.random, iterations = 128,
    budgetMs = Infinity, width = 8, rollout = 2, widening = game.size === 9, onRoot} = {}) {
    if (game.passes >= 2) return null;
    const deadline = performance.now() + budgetMs;
    if (game.passes === 1 && outcome(ending(game)) === side(game)) {
      const move = {type:'pass'};
      if (onRoot) onRoot({visits:0, maxDepth:0, moves:[{move, visits:0, widened:false}]});
      return move;
    }
    const cache = new WeakMap();
    const root = {game, visits:0, sum:0};
    const inspectNode = n => n.info ??= reading.inspect(n.game, cache);
    function setPrior(child, maxRank) {
      child.prior = .045 + Math.exp((child.rank-maxRank) / 2.8);
      child.visits = 0;
      child.sum = 0;
      return child.prior;
    }
    function expand(parent) {
      const atRoot = parent === root;
      const {children:list, extra} = choices(parent.game, inspectNode(parent), random, atRoot ? 2*width : width, widening);
      if (atRoot) {
        const until = Math.min(deadline, performance.now() + budgetMs * .24);
        for (const child of list) {
          if (performance.now() >= until) break;
          if (child.move.type === 'pass') continue;
          const adjustment = reading.ladderAdjustment(game, child, inspectNode(child), until);
          child.rank += adjustment;
          child.tactics = Math.tanh(adjustment / 7);
        }
        list.sort((a,b) => b.rank - a.rank);
      }
      parent.maxRank = list[0].rank;
      parent.mass = 0;
      for (const child of list) parent.mass += setPrior(child, parent.maxRank);
      parent.children = list;
      parent.extra = extra;
      // Give clear captures, escapes and winning passes more reading time first.
      parent.nextWiden = parent.maxRank >= 8 ? 32 : 6;
      parent.added = 0;
    }

    function widen(parent) {
      const candidate = parent.extra.next();
      if (candidate.done) {
        parent.extra = null;
        return null;
      }
      const child = candidate.value;
      child.widened = true;
      parent.mass += setPrior(child, parent.maxRank);
      parent.children.push(child);
      parent.added++;
      parent.nextWiden += 4 + 4*parent.added;
      return child;
    }

    expand(root);
    const rootValue = value(game, root.info, weights);
    for (const child of root.children) {
      child.initial = rootValue;
      if (child.game.passes === 2) child.initial = terminal(child.game);
      else if (performance.now() < deadline) {
        child.initial = read(child.game, inspectNode(child), weights, cache, rollout, deadline);
        child.initial += side(game) * .18 * (child.tactics || 0);
      }
    }

    let maxDepth = 0;
    for (let i=0; i<iterations && (i===0 || performance.now()<deadline); i++) {
      let current = root;
      const path = [current];
      while (current.children) {
        // Give every newly admitted action one real visit, then let PUCT decide.
        if (current.extra && current.visits >= current.nextWiden && performance.now() < deadline) {
          const child = widen(current);
          if (child) {
            current = child;
            path.push(child);
            break;
          }
        }
        let best, high = -Infinity;
        const exploration = 1.65 * Math.sqrt(current.visits+1) / current.mass;
        for (const child of current.children) {
          const initial = child.initial ?? (current.visits ? current.sum/current.visits : rootValue);
          const mean = (child.sum + initial*2) / (child.visits+2);
          const rank = side(current.game)*mean + exploration * child.prior / (child.visits+1);
          if (rank > high) { high = rank; best = child; }
        }
        current = best;
        path.push(current);
        if (current.visits && !current.children && current.game.passes < 2) expand(current);
      }
      const result = current.game.passes === 2 ? terminal(current.game)
        : read(current.game, inspectNode(current), weights, cache, Math.min(1,rollout), deadline);
      maxDepth = Math.max(maxDepth, path.length - 1);
      for (const ancestor of path) { ancestor.sum += result; ancestor.visits++; }
    }
    if (onRoot) onRoot({visits:root.visits, maxDepth, moves:root.children.map(child =>
      ({move:child.move, visits:child.visits, widened:Boolean(child.widened)}))});
    return root.children.reduce((a,b) => b.visits > a.visits ? b : a).move;
  }

  const api = {initialWeights, modelWeights, inspect:reading.inspect, estimate, search, terminal, trainingOutcome:game => outcome(ending(game))};
  if (node) module.exports = api;
  else globalThis.GoridorAI = api;
})();
