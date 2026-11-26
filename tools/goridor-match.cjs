'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {parseArgs} = require('node:util');
const {values, positionals} = parseArgs({allowPositionals:true, options:{
  reference:{type:'string'}, seed:{type:'string'}, ms:{type:'string'}, iterations:{type:'string'}, 'candidate-iterations':{type:'string'},
  progress:{type:'boolean'}
}});
const [file, pairsText = '32'] = positionals;
const pairs = Number(pairsText);
const firstSeed = Number(values.seed ?? 77001);
const budgetMs = values.ms === undefined ? Infinity : Number(values.ms);
const iterations = Number(values.iterations ?? (values.ms ? 480 : 32));
const candidateIterations = Number(values['candidate-iterations'] ?? iterations);
if (!Number.isInteger(candidateIterations) || candidateIterations < 1 || !file || !Number.isInteger(pairs) || pairs < 1 || !Number.isInteger(firstSeed) ||
    !(budgetMs > 0) || !Number.isInteger(iterations) || iterations < 1) {
  throw new Error('Arguments : modèle, nombre de paires, [--reference révision Git] [--seed N] [--ms N] [--iterations N] [--candidate-iterations N] [--progress].');
}
const root = path.resolve(__dirname,'..');
const gameDir = 'dist/jeux/goridor';
const rules = require('../dist/jeux/goridor/rules.js');
const candidate = require('../dist/jeux/goridor/monte-carlo.js');

function loadWeights(file, engine) {
  const model = JSON.parse(fs.readFileSync(file,'utf8'));
  if (engine.modelWeights) {
    const weights = engine.modelWeights(model);
    if (!weights) throw new Error('Modèle 9 × 9 incompatible');
    return weights;
  }
  if (model.size !== 9 || model.version !== 1 || !Array.isArray(model.weights) ||
      model.weights.length !== engine.initialWeights.length || !model.weights.every(Number.isFinite)) {
    throw new Error('Modèle 9 × 9 incompatible');
  }
  return model.weights;
}
function generator(seed) {
  const next = () => ((seed = (Math.imul(1664525,seed) + 1013904223) >>> 0) / 4294967296);
  next.clone = () => generator(seed);
  return next;
}

const temp = values.reference ? fs.mkdtempSync(path.join(os.tmpdir(),'goridor-reference-')) : null;
try {
  let referenceDir = path.join(root,gameDir);
  if (temp) {
    referenceDir = temp;
    const git = args => execFileSync('git',args,{cwd:root});
    const rev = git(['rev-parse','--verify','--end-of-options',values.reference+'^{commit}']).toString().trim();
    const files = git(['ls-tree','--name-only',rev+':'+gameDir]).toString().trim().split(/\r?\n/);
    for (const name of ['monte-carlo.js','modele-9.json','rules.js','lecture.js','life.js','scoring.js']) {
      if (files.includes(name)) fs.writeFileSync(path.join(temp,name),git(['show',rev+':'+gameDir+'/'+name]));
    }
  }
  const old = require(path.join(referenceDir,'monte-carlo.js'));
  const weights = loadWeights(file, candidate), original = loadWeights(path.join(referenceDir,'modele-9.json'), old);
  const stats = {pairs, firstSeed, candidateIterations, reference:values.reference || 'courante', iterations,
    budgetMs:values.ms ? budgetMs : null, wins:0, losses:0, draws:0, capped:0, unsettled:0, blackWins:0, whiteWins:0,
    openings:[], timing:{candidate:{moves:0, totalMs:0}, reference:{moves:0, totalMs:0}}};
  for (let pair = 0; pair < pairs; pair++) {
    const seed = firstSeed + pair;
    const opening = generator(seed);
    const results = {seed};
    let initial = rules.createGame(9);
    for (let n = 0; n < 4; n++) {
      let next;
      while (!next) next = rules.play(initial, {type:'stone',row:Math.floor(opening()*9),col:Math.floor(opening()*9)}).game;
      initial = next;
    }
    for (const color of pair % 2 ? [2,1] : [1,2]) {
      const streams = [null,generator(5*seed+1),generator(5*seed+2)];
      const continuation = opening.clone();
      let game = initial;
      let moves = 4;
      for (; moves<230 && game.passes<2; moves++) {
        const testing = game.turn === color;
        const options = {weights:testing ? weights : original, random:values.reference ? streams[game.turn] : continuation, iterations:testing ? candidateIterations : iterations, budgetMs};
        if (!values.ms) Object.assign(options,{width:4,rollout:1});
        const timing = testing ? stats.timing.candidate : stats.timing.reference;
        const started = performance.now();
        const move = (testing ? candidate : old).search(game,options);
        timing.totalMs += performance.now() - started;
        timing.moves++;
        game = move.type === 'pass' ? rules.pass(game) : rules.play(game,move).game;
        if (!game) throw new Error('Coup illégal dans le match');
      }
      let outcome = 'capped';
      if (game.passes === 2) {
        const score = candidate.trainingOutcome(game);
        if (score === null) outcome = 'unsettled';
        else if (score === 0) outcome = 'draws';
        else outcome = (score > 0 ? 1 : 2) === color ? 'wins' : 'losses';
      }
      stats[outcome]++;
      if (outcome === 'wins') stats[color === 1 ? 'blackWins' : 'whiteWins']++;
      results[color === 1 ? 'candidateBlack' : 'candidateWhite'] = {outcome, moves};
    }
    stats.openings.push(results);
    if (values.progress) console.error(`${pair+1}/${pairs} : ${stats.wins} V, ${stats.losses} D, ${stats.unsettled} incertaines, ${stats.capped} plafonnées`);
  }
  for (const timing of Object.values(stats.timing)) {
    timing.meanMs = Math.round(100 * timing.totalMs / timing.moves) / 100;
    timing.totalMs = Math.round(timing.totalMs);
  }
  console.log(JSON.stringify(stats));
} finally {
  if (temp) {
    for (const file of fs.readdirSync(temp)) fs.unlinkSync(path.join(temp,file));
    fs.rmdirSync(temp);
  }
}
