'use strict';
// 9×9 self-play. Fit the Monte-Carlo leaf evaluator to actual game outcomes.
const fs = require('node:fs');
const path = require('node:path');
const rules = require('../dist/jeux/goridor/rules.js');
const ai = require('../dist/jeux/goridor/monte-carlo.js');
const [folder, deadlineText, initial] = process.argv.slice(2);
const deadline = Number(deadlineText);
if (!folder || !Number.isFinite(deadline)) throw new Error('Arguments: dossier, échéance Unix en ms, point de reprise facultatif');
fs.mkdirSync(folder, {recursive:true});
const latest = path.join(folder, 'reprise.json');
const source = fs.existsSync(latest) ? latest : initial;
const model = source ? JSON.parse(fs.readFileSync(source,'utf8')) : {
  version: 1, size: 9, weights: [...ai.initialWeights], games: 0, samples: 0, capped: 0, seed: 2401126
};
if (model.version !== 1 || model.size !== 9 || model.weights.length !== ai.initialWeights.length ||
    !model.weights.every(Number.isFinite)) throw new Error('Point de reprise incompatible');
function random() {
  model.seed = (Math.imul(1664525, model.seed) + 1013904223) >>> 0;
  return model.seed / 4294967296;
}
function snapshot(file) {
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(model, null, 2));
  fs.renameSync(temp, file);
}
while (Date.now() < deadline) {
  let game = rules.createGame(9);
  const examples = [];
  let moves = 0;
  while (game.passes < 2 && moves < 230) {
    if (Date.now() >= deadline) process.exit(0);
    const info = ai.inspect(game);
    if (moves >= 6 && moves % 4 === 0) examples.push(info.features);
    const move = ai.search(game, {weights:model.weights, iterations:16, width:4, rollout:1, random});
    game = move.type === 'pass' ? rules.pass(game) : rules.play(game, move).game;
    moves++;
  }
  if (game.passes < 2) model.capped++;
  else {
    const target = ai.terminal(game);
    const gradient = model.weights.map(() => 0);
    for (const x of examples) {
      const prediction = ai.estimate(x, model.weights);
      const error = (target - prediction) * (1 - prediction * prediction) / 3;
      x.forEach((value,i) => { gradient[i] += error * value; });
    }
    const rate = .06 / Math.sqrt(1 + model.games / 300);
    model.weights = model.weights.map((w,i) => w + rate * gradient[i] / Math.max(1,examples.length));
    model.games++; model.samples += examples.length;
  }
  snapshot(latest);
  if ((model.games + model.capped) % 250 === 0) snapshot(path.join(folder, 'parties-' + (model.games + model.capped) + '.json'));
  console.log(JSON.stringify({time:new Date().toISOString(),games:model.games,samples:model.samples,capped:model.capped,moves}));
}
