(() => {
  'use strict';

  const node = typeof module === 'object';
  const rules = node ? require('./rules.js') : globalThis.TopogoRules;
  const reading = node ? require('./ai-reading.js') : globalThis.TopogoReading;
  const { inspect, sign } = reading;
  const byRank = (a, b) => b.rank - a.rank;
  const pass = { type: 'pass' };

  function value(game, info) {
    if (game.passes >= 2) {
      const { totals } = rules.score(game);
      return Math.sign(totals[rules.BLACK] - totals[rules.WHITE]);
    }
    // Retain score sensitivity even when one side already leads by several captures.
    return 2 / Math.PI * Math.atan(info.lead / (game.size * .65));
  }

  // The quiet estimate represents playing elsewhere. Explore captures and escapes
  // before accepting it, including barriers that close two liberties at once.
  function read(game, info, depth, branches, deadline, alpha = -1, beta = 1) {
    const side = sign(game.turn);
    let best = side * value(game, info);
    if (!depth || game.passes >= 2 || performance.now() >= deadline || best >= beta) return best;
    alpha = Math.max(alpha, best);
    for (const child of reading.tactical(game, info, branches)) {
      if (performance.now() >= deadline) break;
      const reply = -read(child.game, inspect(child.game), depth - 1, branches, deadline, -beta, -alpha);
      best = Math.max(best, reply);
      if (best >= beta) break;
      alpha = Math.max(alpha, best);
    }
    return best;
  }

  function capturePreference(before, after, info, until) {
    if (after.passes >= 2) return 0;
    const player = before.turn;
    const gain = after.captures[player] - before.captures[player];
    // Check the immediate reply even after a quiet move. In Topogo two adjacent
    // liberties can be as urgent as an ordinary atari.
    const threatened = info.groups.some(group =>
      group.color === player && (group.liberties.size === 1 || group.wallAtari));
    const reply = threatened ? reading.tactical(after, info, 6) : [];
    const loss = Math.max(0, ...reply.map(child => child.game.captures[after.turn] - after.captures[after.turn]));
    let risk = 0;
    const move = after.lastMove;
    if (move.type === 'stone') {
      const group = info.chain[move.point];
      const netLoss = group.points.length - gain;
      if (netLoss > 0 && group.liberties.size <= 2 && reading.caught(after, move.point, after.turn, until)) {
        risk = .38 + .13 * Math.log2(1 + netLoss);
      }
    }
    return .24 * Math.tanh((gain - loss) / 2) - risk;
  }

  function* extraChoices(stones, walls) {
    // Keep both action families in the widening pool.
    const streams = [stones, walls];
    while (streams.length) {
      const stream = streams.shift();
      const candidate = stream.next();
      if (candidate.done) continue;
      streams.push(stream);
      yield candidate.value;
    }
  }

  function* takeFromEnd(candidates) {
    while (candidates.length) yield candidates.pop();
  }

  function choices(game, info, random, width, fullReserve) {
    const [stoneMoves, wallMoves] = reading.ranked(game, info, random, fullReserve);
    const stones = reading.legal(game, takeFromEnd(stoneMoves.reverse()));
    const walls = reading.legal(game, takeFromEnd(wallMoves.reverse()));
    const children = [];
    const wallWidth = Math.ceil(width / 3);
    for (const [stream, limit] of [[stones, width], [walls, wallWidth]]) {
      for (let i = 0; i < limit; i++) {
        const candidate = stream.next();
        if (candidate.done) break;
        children.push(candidate.value);
      }
    }
    if (!fullReserve && !children.length) return choices(game, info, random, width, true);
    // Keep the full reserve at the root. Below it retain just enough candidates
    // to widen promising lines without holding a full board's moves at every node.
    if (!fullReserve) {
      stoneMoves.splice(0, Math.max(0, stoneMoves.length - (2 * width + 5)));
      wallMoves.splice(0, Math.max(0, wallMoves.length - (wallWidth + 5)));
    }
    const bestRank = Math.max(-Infinity, ...children.map(child => child.rank));
    const covered = (info.occupied + info.settled) / info.playable;
    const late = covered >= .66 || info.occupied / info.playable >= .53;
    const ready = game.passes === 1 && covered >= .42 && info.contested < info.playable * .23;
    const quiet = info.occupied > 0 && bestRank < -2;
    if (!children.length || late || ready || quiet) {
      const winningCount = ready && bestRank < 7 && sign(game.turn) * value(rules.pass(game), null) > 0;
      const rank = winningCount ? 4 : quiet ? 4 : -3.8;
      children.push({ move: pass, game: rules.pass(game), rank });
    }
    return { children: children.sort(byRank), extra: extraChoices(stones, walls) };
  }

  function search(game, { random = Math.random, iterations = 420, budgetMs = Infinity,
    width = 8, maxDepth = 10, tacticalDepth = 2, onRoot } = {}) {
    if (game.passes >= 2) return null;
    const deadline = performance.now() + budgetMs;
    const root = { game, visits: 0, sum: 0 };
    const rootInfo = inspect(game);
    const wideOpening = game.size > 9 && rootInfo.occupied < game.size &&
      rootInfo.groups.every(group => group.liberties.size > 2);
    const initial = value(game, rootInfo);
    const rootDeadline = Math.min(deadline, performance.now() + budgetMs * .19);
    const recentLeaves = new Map();

    function addChild(parent, child, readUntil = rootDeadline) {
      // Tactical priorities guide exploration while keeping a floor for quiet moves.
      child.prior = .045 + Math.exp((child.rank - parent.bestRank) / 3);
      child.visits = 0;
      child.sum = 0;
      if (parent === root && performance.now() < deadline) {
        const info = inspect(child.game);
        const chaseUntil = Number.isFinite(deadline) ? Math.min(deadline, performance.now() + 8) : Infinity;
        child.capture = capturePreference(game, child.game, info, chaseUntil);
        child.initial = sign(child.game.turn) * read(child.game, info, tacticalDepth, 4, readUntil);
      }
      parent.mass += child.prior;
      parent.children.push(child);
    }

    function expand(parent, depth) {
      const atRoot = parent === root;
      let nodeWidth = 2;
      if (atRoot) nodeWidth = wideOpening ? width + 2 : width * 2;
      else if (depth < 3) nodeWidth = wideOpening ? 3 : Math.ceil(width / 2);
      else if (depth < 6 && !wideOpening) nodeWidth = 3;
      const info = atRoot ? rootInfo : recentLeaves.get(parent) ?? inspect(parent.game);
      recentLeaves.delete(parent);
      const { children, extra } = choices(parent.game, info, random, nodeWidth, atRoot);
      parent.bestRank = children[0].rank;
      parent.mass = 0;
      parent.children = [];
      for (const [index, child] of children.entries()) {
        if (atRoot) {
          const now = performance.now();
          addChild(parent, child, now + (rootDeadline - now) / (children.length - index));
        } else addChild(parent, child);
      }
      parent.extra = extra;
      const rootWiden = wideOpening || parent.bestRank >= 8 ? 24 : 7;
      parent.nextWiden = atRoot ? rootWiden : 19 + 6 * depth;
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
      addChild(parent, child);
      parent.added++;
      parent.nextWiden += 5 + 4 * parent.added;
      return child;
    }

    function select(parent, startValue) {
      let best, high = -Infinity;
      const exploration = parent === root ? 1.55 : 1.05;
      const rate = exploration * Math.sqrt(parent.visits + 1) / parent.mass;
      const side = sign(parent.game.turn);
      for (const child of parent.children) {
        const initial = child.initial ?? startValue;
        const mean = (child.sum + 2 * initial) / (child.visits + 2);
        const rank = side * mean + (child.capture ?? 0) + rate * child.prior / (child.visits + 1);
        if (rank <= high) continue;
        high = rank;
        best = child;
      }
      return best;
    }

    function evaluateLeaf(leaf, depth) {
      if (leaf.value !== undefined) return leaf.value;
      const state = leaf.game;
      const info = inspect(state);
      leaf.value = sign(state.turn) * read(state, info, Math.min(1, tacticalDepth), 2, deadline);
      if (state.passes < 2 && !leaf.children && depth < maxDepth) {
        // Reuse a recent analysis when its leaf is expanded, with limited memory on 19×19.
        if (recentLeaves.size >= 128) recentLeaves.delete(recentLeaves.keys().next().value);
        recentLeaves.set(leaf, info);
      }
      return leaf.value;
    }

    expand(root, 0);
    let deepest = 0, depthSum = 0;
    for (let i = 0; i < iterations && (i === 0 || performance.now() < deadline); i++) {
      let current = root;
      const path = [current];
      while (path.length <= maxDepth && current.game.passes < 2) {
        if (!current.children) {
          if (!current.visits || performance.now() >= deadline) break;
          expand(current, path.length - 1);
        }
        const fresh = current.extra && current.visits >= current.nextWiden && performance.now() < deadline
          ? widen(current) : null;
        current = fresh ?? select(current, current.visits ? current.sum / current.visits : initial);
        path.push(current);
        if (fresh) break;
      }
      const depth = path.length - 1;
      const result = evaluateLeaf(current, depth);
      deepest = Math.max(deepest, depth);
      depthSum += depth;
      for (const position of path) {
        position.sum += result;
        position.visits++;
      }
    }
    onRoot?.({
      visits: root.visits, maxDepth: deepest, meanDepth: depthSum / Math.max(1, root.visits), moves: root.children.map(child =>
        ({ move: child.move, visits: child.visits, widened: Boolean(child.widened) })),
    });
    return root.children.reduce((a, b) => b.visits > a.visits ? b : a).move;
  }

  const ai = { search };
  if (node) module.exports = ai;
  else globalThis.TopogoAI = ai;
})();
