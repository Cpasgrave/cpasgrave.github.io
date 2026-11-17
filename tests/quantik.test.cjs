const {test} = require("node:test");
const assert = require("node:assert/strict");
const game = require("../dist/jeux/quantik/engine.js");
const ai = require("../dist/jeux/quantik/ai.js");

function sequence(pairs, first = 0) {
  return pairs.reduce((state, [cell,shape]) => {
    const next = game.play(state,{cell,shape});
    assert.ok(next, "Illegal fixture move at "+cell);
    return next;
  }, game.initial(first));
}
function random(seed) {
  return () => ((seed = (Math.imul(seed,1664525) + 1013904223) >>> 0) / 4294967296);
}

test("opponent blocks row, column and region, own shape may repeat twice", () => {
  const first = sequence([[0,1]]);
  for (const cell of [1,2,3,4,5,8,12]) assert.equal(game.play(first,{cell,shape:1}), null);
  assert.ok(game.play(first,{cell:10,shape:1}));
  const own = sequence([[0,1],[15,0]]);
  assert.ok(game.play(own,{cell:1,shape:1}));
  assert.equal(game.play(own,{cell:0,shape:2}), null);
  const used = sequence([[0,1],[15,0],[1,1],[14,3]]);
  assert.equal(game.targets(used,0,1), 0);
  const overlap = sequence([[0,1],[10,1]]);
  assert.equal(game.play(overlap,{cell:2,shape:1}), null);
  for (const move of [null,{cell:16,shape:2},{cell:-1,shape:0},{cell:2,shape:4},{cell:2.1,shape:1}]) {
    assert.equal(game.play(own,move),null);
  }
});

test("twelve winning groups in either color, mixed ownership and no diagonal win", () => {
  const groups = [[0,1,2,3],[4,5,6,7],[8,9,10,11],[12,13,14,15],
    [0,4,8,12],[1,5,9,13],[2,6,10,14],[3,7,11,15],[0,1,4,5],[2,3,6,7],[8,9,12,13],[10,11,14,15]];
  for (const group of groups) for (const first of [0,1]) {
    const end = sequence(group.map((cell,shape) => [cell,shape]),first);
    assert.equal(end.winner,1-first);
    assert.deepEqual(end.lines,[group.reduce((mask,cell) => mask | (1 << cell),0)]);
    assert.equal(end.reason,"quartet"); assert.deepEqual(game.moves(end),[]);
    assert.equal(game.play(end,{cell:7,shape:0}),null);
  }
  assert.equal(sequence([[0,0],[5,1],[10,2],[15,3]]).winner,null);
  const double = sequence([[13,0],[6,0],[3,3],[5,2],[10,2],[12,2],[11,2],[2,1],[1,0],[15,1],[0,3],[14,3]]);
  assert.equal(double.lines.length,2);
});

test("no legal placement loses immediately even when empty squares remain", () => {
  const end = sequence([[14,0],[6,1],[9,2],[4,1],[3,0],[2,3],[15,1],[7,3],[5,2],[8,0],[13,1]]);
  assert.equal(end.ply,11); assert.equal(end.reason,"blocked"); assert.equal(end.winner,0);
  assert.equal(ai.choose(end,8),null);
});

test("200 games agree with independent coordinate and inventory rules on every turn", () => {
  const rng = random(125);
  const row = c => Math.floor(c/4), col = c => c%4, region = c => Math.floor(row(c)/2)*2+Math.floor(col(c)/2);
  const zones = [row,col,region];
  for (let seed = 0; seed < 200; seed++) {
    let state = game.initial(seed%2);
    const board = Array(16).fill(-1);
    for (;;) {
      const legal = [];
      for (let shape = 0; shape < 4; shape++) for (let cell = 0; cell < 16; cell++) {
        if (board[cell] !== -1 || board.filter(p => p === state.turn*4+shape).length === 2) continue;
        if (!board.some((p,c) => p === (1-state.turn)*4+shape && zones.some(zone => zone(c) === zone(cell)))) {
          legal.push({cell,shape});
        }
      }
      if (state.winner !== null) {
        assert.equal(state.winner,1-state.turn);
        if (state.reason === "blocked") assert.equal(legal.length,0);
        break;
      }
      assert.deepEqual(game.moves(state),legal);
      const move = legal[Math.floor(rng()*legal.length)];
      board[move.cell] = state.turn*4+move.shape;
      state = game.play(state,move);
      const quartet = zones.some(zone => {
        const pieces = board.filter((_,cell) => zone(cell) === zone(move.cell));
        return pieces.every(p => p >= 0) && new Set(pieces.map(p => p%4)).size === 4;
      });
      assert.equal(state.reason === "quartet",quartet);
      assert.deepEqual(board,board.map((_,c) => game.pieceAt(state,c)));
    }
  }
});

test("all eight profiles play legally without modifying the input; levels 3–8 win and defend", () => {
  const win = sequence([[0,0],[1,1],[2,2]]);
  const threat = sequence([[14,2],[10,3],[3,3],[8,3],[0,1],[7,2],[9,0]]);
  for (let level = 1; level <= 8; level++) {
    const copy = structuredClone(threat);
    const choice = ai.choose(threat,level,{rng:random(level)});
    assert.deepEqual(threat,copy); assert.ok(game.play(threat,choice));
    if (level >= 3) {
      assert.deepEqual(choice,{cell:5,shape:2});
      assert.equal(game.play(win,ai.choose(win,level)).winner,win.turn);
    }
  }
});
