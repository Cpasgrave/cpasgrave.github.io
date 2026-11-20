const { test } = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../dist/jeux/quoridor/engine.js');
const AI = require('../dist/jeux/quoridor/ai.js');
const asSet = values => new Set(values);
const wall = (r,c,o) => ({ type:'wall',r,c,o });

test('two and four players start on opposing sides with twenty walls in total', () => {
  for (const count of [2,4]) {
    const s=Q.createGame(count);
    assert.equal(s.players.length,count);
    assert.equal(s.players.reduce((sum,p)=>sum+p.walls,0),20);
    assert.equal(new Set(s.players.map(p=>p.position)).size,count);
    for(let i=0;i<count;i++) assert.equal(Q.distance(s,i),8);
  }
});
test('normal steps, straight jumps, blocked-jump diagonals and board edges', () => {
  const s=Q.createGame();s.players[0].position=40;s.players[1].position=31;
  assert.deepEqual(asSet(Q.moves(s)),asSet([22,39,41,49]));
  s.walls.push(wall(2,3,'h'));
  assert.deepEqual(asSet(Q.moves(s)),asSet([30,32,39,41,49]));
  s.walls=[];s.players[0].position=13;s.players[1].position=4;
  assert.deepEqual(asSet(Q.moves(s)),asSet([3,5,12,14,22]));
  s.walls.push(wall(0,3,'h'));
  assert.deepEqual(asSet(Q.moves(s)),asSet([12,14,22]));
});
test('four-player jumps never chain over two pawns; lateral jumps avoid occupied squares', () => {
  const s=Q.createGame(4);[40,31,22,30].forEach((position,i)=>s.players[i].position=position);
  const moves=Q.moves(s);
  assert.ok(moves.includes(32));assert.ok(!moves.includes(13));assert.ok(!moves.includes(22));assert.ok(!moves.includes(30));
});
test('walls cannot cross or overlap, but may touch at their ends or form a T', () => {
  const s=Q.createGame();s.walls.push(wall(3,3,'h'));
  assert.match(Q.wallError(s,wall(3,3,'v')),/croiser/);
  assert.match(Q.wallError(s,wall(3,2,'h')),/chevauche/);
  assert.match(Q.wallError(s,wall(3,4,'h')),/chevauche/);
  assert.equal(Q.wallError(s,wall(3,5,'h')),'');
  assert.equal(Q.wallError(s,wall(2,3,'v')),'');
  assert.match(Q.wallError(s,wall(8,3,'h')),/rainure/);
});
test('closing the last route is forbidden, even for a non-active fourth player', () => {
  const s=Q.createGame(4);
  // Seal the first eight columns along the top row, then close the ninth exit.
  s.walls=[wall(0,0,'h'),wall(0,2,'h'),wall(0,4,'h'),wall(0,6,'h')];
  assert.match(Q.wallError(s,wall(0,7,'v')),/chemin/);
  s.walls.push(wall(0,7,'v'));
  // Top pawn is trapped behind the horizontal wall and vertical end cap.
  assert.equal(Q.distance(s,2),Infinity);
});
test('wall-path validation ignores temporary pawn occupancy and rejects enclosing players', () => {
  const s=Q.createGame();s.players[0].position=80;
  s.walls=[wall(7,7,'h')];
  assert.match(Q.wallError(s,wall(7,7,'v')),/croiser/);
  s.walls=[wall(6,7,'v')];
  assert.equal(Q.wallError(s,wall(7,7,'h')),'');
  const t=Q.createGame(4);t.players[3].position=80;t.walls=[wall(7,7,'h')];
  assert.match(Q.wallError(t,wall(7,6,'v')),/chemin/);
});
test('one action per turn, wall stocks, victory and input state are respected', () => {
  const s=Q.createGame();const original=JSON.stringify(s);
  const next=Q.apply(s,wall(3,3,'h'));
  assert.equal(JSON.stringify(s),original);assert.equal(next.turn,1);assert.equal(next.players[0].walls,9);assert.equal(next.ply,1);
  const end=Q.createGame();end.players[0].position=13;end.players[1].position=0;
  const won=Q.apply(end,{type:'move',to:4});assert.equal(won.winner,0);
  assert.throws(()=>Q.apply(won,{type:'move',to:5}),/terminée/);
  s.players[0].walls=0;assert.match(Q.wallError(s,wall(3,3,'h')),/plus de barrière/);
  assert.throws(()=>Q.apply(s,{type:'move',to:0}),/possible/);
});
test('all eight levels take an immediate win, for either player count', () => {
  for(const count of [2,4]) for(let level=1;level<=8;level++) {
    const s=Q.createGame(count);s.players[0].position=13;
    if(count===2)s.players[1].position=0;else s.players[2].position=0;
    const result=AI.choose(s,level,{random:()=>.5});
    assert.equal(Q.apply(s,result.action).winner,0);
  }
});
test('a temporarily immobilized player places a wall if possible, and only otherwise passes', () => {
  const s=Q.createGame(4);[80,71,62,36].forEach((position,i)=>s.players[i].position=position);
  s.walls=[wall(7,7,'v')];s.players[0].walls=1;
  assert.equal(Q.moves(s).length,0);
  assert.throws(()=>Q.apply(s,{type:'pass'}),/possible/);
  const result=AI.choose(s,1);assert.equal(result.action.type,'wall');Q.apply(s,result.action);
  s.players[0].walls=0;
  const next=Q.apply(s,{type:'pass'});assert.equal(next.turn,1);
});
test('tactical levels block an opponent one move from victory', () => {
  for(const count of [2,4]) {
    const s=Q.createGame(count);const rival=count===2?1:2;
    s.players[0].position=60;s.players[rival].position=67;
    for(const level of [3,5,8]) {
      const result=AI.choose(s,level,{budget:80,random:()=>.5});
      assert.equal(result.action.type,'wall');
      const next=Q.apply(s,result.action);
      assert.ok(!Q.moves(next,rival).some(to=>Q.goalReached(to,s.players[rival].goal)));
    }
  }
});
test('complete games produce legal moves, preserve every route, and finish', () => {
  for(const count of [2,4]) for(const level of [1,3,5,8]) {
    let s=Q.createGame(count), history=[];
    for(let turn=0;turn<220 && s.winner===null;turn++) {
      const result=AI.choose(s,level,{budget:35,random:()=>.5,trails:AI.pawnTrails(s,history)});
      history.push(s); s=Q.apply(s,result.action);
      assert.equal(new Set(s.players.map(p=>p.position)).size,count);
      for(let i=0;i<count;i++)assert.ok(Number.isFinite(Q.distance(s,i)));
      assert.equal(s.players.reduce((sum,p)=>sum+p.walls,0)+s.walls.length,20);
    }
    assert.notEqual(s.winner,null,`${count} players at level ${level} did not finish`);
  }
});

test('four master AIs: orange takes the clear three-move finish before beige and green', () => {
  let state = Q.createGame(4, 3);
  [79, 67, 41, 3].forEach((position, i) => { state.players[i].position = position; });
  // All twenty barriers are on the board. Orange moves from D9 to D8.
  // The old master went straight back to D9 and lost to beige by one turn.
  const placements = 'v43 v34 h36 v31 h60 h53 v20 h32 h62 h21 h42 h30 v35 v51 v63 h50 v23 h24 v52 v22';
  for (const [o, r, c] of placements.split(' ')) state = Q.apply(state, wall(Number(r), Number(c), o));
  const history = [], orangeMoves = [];
  for (const to of [12, 78, 68, 50]) {
    history.push(state);
    state = Q.apply(state, { type: 'move', to });
  }
  for (let i = 0; i < 9 && state.winner === null; i++) {
    const { action } = AI.choose(state, 8, { trails: AI.pawnTrails(state, history) });
    if (state.turn === 3) orangeMoves.push(action.to);
    history.push(state);
    state = Q.apply(state, action);
  }
  assert.deepEqual(orangeMoves, [11, 10, 9]);
  assert.equal(state.winner, 3);
});

test('each pawn remembers its own route across rival turns and reevaluates it after a wall', () => {
  let state = Q.createGame(4);
  const history = [];
  for (const to of [67, 37, 13, 43, 58]) {
    history.push(state);
    state = Q.apply(state, { type: 'move', to });
  }
  assert.deepEqual(AI.pawnTrails(state, history), [[76, 67], [36], [4], [44]]);
  history.push(state);
  state = Q.apply(state, wall(3, 3, 'h'));
  assert.deepEqual(AI.pawnTrails(state, history), [[], [], [], []]);
});

test('a previous square is still playable when it is the only way out', () => {
  const state = Q.createGame(4, 3);
  state.players[3].position = 42;
  state.players[3].walls = 0;
  state.walls = [wall(3, 5, 'v'), wall(3, 6, 'h'), wall(4, 6, 'h')];
  assert.deepEqual(Q.moves(state), [43]);
  const { action } = AI.choose(state, 8, { trails: [[], [], [], [43]] });
  assert.deepEqual(action, { type: 'move', to: 43 });
});
