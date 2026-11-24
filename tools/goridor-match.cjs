'use strict';
const fs = require('node:fs');
const rules = require('../dist/jeux/goridor/rules.js');
const ai = require('../dist/jeux/goridor/monte-carlo.js');
const reference = require('../dist/jeux/goridor/modele-9.json');
const [file, pairsText = '32'] = process.argv.slice(2);
const pairs = Number(pairsText);
if (!file || !Number.isInteger(pairs) || pairs < 1) throw new Error('Arguments : point de reprise et nombre de paires.');
const candidate = JSON.parse(fs.readFileSync(file, 'utf8'));
if (candidate.size !== 9 || candidate.version !== 1 || !Array.isArray(candidate.weights) ||
    candidate.weights.length !== reference.weights.length || !candidate.weights.every(Number.isFinite)) {
  throw new Error('Modèle 9 × 9 incompatible');
}
const stats = { pairs, wins: 0, losses: 0, capped: 0, iterations: 32 };
for (let pair = 0; pair < pairs; pair++) {
  for (const color of [1, 2]) {
    let seed = 77001 + pair;
    const random = () => ((seed = (Math.imul(1664525,seed) + 1013904223) >>> 0) / 4294967296);
    let game = rules.createGame(9);
    // Identical opening and random stream for the two colour assignments.
    for (let n = 0; n < 4; n++) {
      let next;
      while (!next) next = rules.play(game, { type:'stone', row:Math.floor(random()*9), col:Math.floor(random()*9) }).game;
      game = next;
    }
    for (let n = 4; n < 230 && game.passes < 2; n++) {
      const weights = (game.turn === color ? candidate : reference).weights;
      const move = ai.search(game, { weights, random, iterations:stats.iterations, width:4, rollout:1 });
      game = move.type === 'pass' ? rules.pass(game) : rules.play(game, move).game;
    }
    if (game.passes < 2) stats.capped++;
    else if (ai.terminal(game) === (color === 1 ? 1 : -1)) stats.wins++;
    else stats.losses++;
  }
}
console.log(JSON.stringify(stats));
