(() => {
  'use strict';

  const node = typeof module === 'object';
  const rules = node ? require('./rules.js') : globalThis.TopogoRules;
  const reading = node ? require('./ai-reading.js') : globalThis.TopogoReading;
  const { inspect, sign } = reading;
  const byRank = (a, b) => b.rank - a.rank;
  const pass = { type: 'pass' };

  function value(game, info, terminal = false) {
    const lead = terminal ? info.count : info.lead;
    const scale = game.size * .9;
    return Math.tanh(lead / scale);
  }

  // The quiet estimate represents playing elsewhere. Explore captures and escapes
  // before accepting it, including barriers that close two liberties at once.
  function read(game, info, depth, branches, deadline) {
    let best = value(game, info, game.passes >= 2);
    if (!depth || game.passes >= 2 || performance.now() >= deadline) return best;
    const side = sign(game.turn);
    for (const child of reading.tactical(game, info, branches)) {
      if (performance.now() >= deadline) break;
      const response = read(child.game, inspect(child.game), depth - 1, branches, deadline);
      if (side * response > side * best) best = response;
    }
    return best;
  }

  function capturePreference(before, after, info) {
    if (after.passes >= 2) return 0;
    const player = before.turn;
    const gain = after.captures[player] - before.captures[player];
    // Check the immediate reply even after a quiet move. In Topogo two adjacent
    // liberties can be as urgent as an ordinary atari.
    const threatened = info.groups.some(group =>
      group.color === player && (group.liberties.size === 1 || group.wallAtari));
    const reply = threatened ? reading.tactical(after, info, 6) : [];
    const loss = Math.max(0, ...reply.map(child => child.game.captures[after.turn] - after.captures[after.turn]));
    return .27 * Math.tanh((gain - loss) / 2);
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

  function choices(game, info, random, width) {
    const [stoneMoves, wallMoves] = reading.ranked(game, info, random);
    const stones = reading.legal(game, stoneMoves), walls = reading.legal(game, wallMoves);
    const children = [];
    for (const [stream, limit] of [[stones, width], [walls, Math.max(2, Math.ceil(width / 3))]]) {
      for (let i = 0; i < limit; i++) {
        const candidate = stream.next();
        if (candidate.done) break;
        children.push(candidate.value);
      }
    }
    const bestRank = Math.max(-Infinity, ...children.map(child => child.rank));
    const covered = (info.occupied + info.settled) / info.playable;
    const late = covered >= .66 || info.occupied / info.playable >= .53;
    const ready = game.passes === 1 && covered >= .42 && info.contested < info.playable * .23;
    const quiet = info.occupied > 0 && bestRank < -2;
    if (!children.length || late || ready || quiet) {
      const winningCount = ready && sign(game.turn) * info.count > 0 && bestRank < 7;
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
    const inspectNode = position => position.info ??= inspect(position.game);

    function addChild(parent, child) {
      // Tactical priorities guide exploration while keeping a floor for quiet moves.
      child.prior = .045 + Math.exp((child.rank - parent.bestRank) / 3);
      child.visits = 0;
      child.sum = 0;
      if (parent === root && performance.now() < deadline) {
        child.capture = capturePreference(game, child.game, inspectNode(child));
      }
      parent.mass += child.prior;
      parent.children.push(child);
    }

    function expand(parent) {
      const atRoot = parent === root;
      const { children, extra } = choices(parent.game, inspectNode(parent), random, atRoot ? width * 2 : width);
      parent.bestRank = children[0].rank;
      parent.mass = 0;
      parent.children = [];
      for (const child of children) addChild(parent, child);
      parent.extra = extra;
      parent.nextWiden = parent.bestRank >= 8 ? 24 : 7;
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
      const rate = 2.05 * Math.sqrt(parent.visits + 1) / parent.mass;
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

    expand(root);
    const initial = value(game, root.info);
    const rootDeadline = Math.min(deadline, performance.now() + budgetMs * .29);
    for (const child of root.children) {
      if (performance.now() >= rootDeadline) break;
      const info = inspectNode(child);
      child.initial = read(child.game, info, tacticalDepth, 4, rootDeadline);
    }

    let deepest = 0;
    for (let i = 0; i < iterations && (i === 0 || performance.now() < deadline); i++) {
      let current = root;
      const path = [current];
      while (path.length <= maxDepth && current.game.passes < 2) {
        if (!current.children) {
          if (!current.visits || performance.now() >= deadline) break;
          expand(current);
        }
        const fresh = current.extra && current.visits >= current.nextWiden && performance.now() < deadline
          ? widen(current) : null;
        current = fresh ?? select(current, current.visits ? current.sum / current.visits : initial);
        path.push(current);
        if (fresh) break;
      }
      const result = read(current.game, inspectNode(current), Math.min(2, tacticalDepth), 2, deadline);
      deepest = Math.max(deepest, path.length - 1);
      for (const position of path) {
        position.sum += result;
        position.visits++;
      }
    }
    onRoot?.({
      visits: root.visits, maxDepth: deepest, moves: root.children.map(child =>
        ({ move: child.move, visits: child.visits, widened: Boolean(child.widened) })),
    });
    return root.children.reduce((a, b) => b.visits > a.visits ? b : a).move;
  }

  const ai = { search };
  if (node) module.exports = ai;
  else globalThis.TopogoAI = ai;
})();
