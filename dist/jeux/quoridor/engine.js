/* Quoridor rules, independent of the DOM. Positions are row-major, 0…80. */
"use strict";
const Quoridor = (() => {
  const SIZE = 9;
  const DIRECTIONS = [-9, 1, 9, -1];
  const goalReached = (position, goal) => goal === 'N' ? position < 9 : goal === 'S' ? position >= 72 : goal === 'W' ? position % 9 === 0 : position % 9 === 8;
  function createGame(count = 2, first = 0) {
    if (count !== 2 && count !== 4) throw new Error('Choisir deux ou quatre joueurs.');
    const starts = count === 2 ? [[76, 'N'], [4, 'S']] : [[76, 'N'], [36, 'E'], [4, 'S'], [44, 'W']];
    return { players: starts.map(([position, goal]) => ({ position, goal, walls: 20 / count })), walls: [], turn: first % count, winner: null, ply: 0 };
  }
  function graph(state) {
    const edges = Array.from({ length: 81 }, (_, i) => [i >= 9 ? i - 9 : -1, i % 9 < 8 ? i + 1 : -1, i < 72 ? i + 9 : -1, i % 9 ? i - 1 : -1]);
    for (const wall of state.walls) {
      const a = wall.r * 9 + wall.c;
      if (wall.o === 'h') {
        edges[a][2] = edges[a + 1][2] = -1;
        edges[a + 9][0] = edges[a + 10][0] = -1;
      } else {
        edges[a][1] = edges[a + 9][1] = -1;
        edges[a + 1][3] = edges[a + 10][3] = -1;
      }
    }
    return edges;
  }
  function moves(state, player = state.turn, from = state.players[player].position, edges = graph(state)) {
    const occupied = new Set(state.players.filter((_, i) => i !== player).map(p => p.position));
    const result = new Set();
    for (let d = 0; d < 4; d++) {
      const next = edges[from][d];
      if (next < 0) continue;
      if (!occupied.has(next)) { result.add(next); continue; }
      const behind = edges[next][d];
      if (behind >= 0 && !occupied.has(behind)) result.add(behind);
      else {
        // A wall, board edge, or third pawn prevents the straight jump.
        // Never jump a chain of pawns; only the two free lateral squares apply.
        for (const side of [(d + 1) % 4, (d + 3) % 4]) {
          const landing = edges[next][side];
          if (landing >= 0 && !occupied.has(landing)) result.add(landing);
        }
      }
    }
    return [...result];
  }
  function distance(state, player, edges = graph(state), withPawns = false) {
    const seen = new Int16Array(81).fill(-1), queue = new Uint8Array(81);
    const start = state.players[player].position;
    queue[0] = start; seen[start] = 0;
    let head = 0, tail = 1;
    while (head < tail) {
      const here = queue[head++];
      if (goalReached(here, state.players[player].goal)) return seen[here];
      const nexts = withPawns ? moves(state, player, here, edges) : edges[here];
      for (const next of nexts) if (next >= 0 && seen[next] < 0) {
        seen[next] = seen[here] + 1; queue[tail++] = next;
      }
    }
    return Infinity;
  }
  function wallError(state, wall, player = state.turn, checkPaths = true) {
    if (state.winner !== null) return 'La partie est terminée.';
    if (!state.players[player]?.walls) return 'Il ne reste plus de barrière à ce joueur.';
    if (!wall || !Number.isInteger(wall.r) || !Number.isInteger(wall.c) || wall.r < 0 || wall.c < 0 || wall.r > 7 || wall.c > 7 || !['h', 'v'].includes(wall.o)) return 'Place la barrière dans une rainure du plateau.';
    for (const other of state.walls) {
      if (wall.o !== other.o && wall.r === other.r && wall.c === other.c) return 'Deux barrières ne peuvent pas se croiser.';
      if (wall.o === other.o && (wall.o === 'h' ? wall.r === other.r && Math.abs(wall.c - other.c) < 2 : wall.c === other.c && Math.abs(wall.r - other.r) < 2)) return 'Cette barrière chevauche une autre barrière.';
    }
    if (checkPaths) {
      const next = { ...state, walls: [...state.walls, wall] }, edges = graph(next);
      if (state.players.some((_, i) => !Number.isFinite(distance(next, i, edges)))) return 'Il faut laisser un chemin vers l’arrivée à chaque joueur.';
    }
    return '';
  }
  function legalWalls(state, player = state.turn) {
    if (!state.players[player].walls || state.winner !== null) return [];
    const result = [];
    for (const o of ['h', 'v']) for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const wall = { type: 'wall', r, c, o };
      if (!wallError(state, wall, player)) result.push(wall);
    }
    return result;
  }
  function apply(state, action, validate = true) {
    if (state.winner !== null) throw new Error('La partie est terminée.');
    const player = state.turn;
    if (!action) throw new Error('Coup manquant.');
    if (action.type === 'move') {
      if (validate && !moves(state).includes(action.to)) throw new Error('Ce déplacement n’est pas possible.');
    } else if (action.type === 'wall') {
      if (validate) { const error = wallError(state, action); if (error) throw new Error(error); }
    } else if (action.type === 'pass') {
      if (validate && (moves(state).length || legalWalls(state).length)) throw new Error('Un coup est encore possible.');
    } else throw new Error('Coup inconnu.');
    const next = { ...state, players: state.players.map(p => ({ ...p })), walls: state.walls.slice(), ply: state.ply + 1 };
    if (action.type === 'move') {
      next.players[player].position = action.to;
      if (goalReached(action.to, next.players[player].goal)) next.winner = player;
    } else if (action.type === 'wall') {
      next.players[player].walls--;
      next.walls.push({ r: action.r, c: action.c, o: action.o, player });
    }
    if (next.winner === null) next.turn = (player + 1) % next.players.length;
    return next;
  }
  const key = state => `${state.turn}:${state.players.map(p => `${p.position},${p.walls}`).join(';')}:${state.walls.map(w => `${w.o}${w.r}${w.c}`).sort().join('')}`;
  return { SIZE, DIRECTIONS, createGame, goalReached, graph, moves, distance, wallError, legalWalls, apply, key };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Quoridor;
