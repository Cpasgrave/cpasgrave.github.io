'use strict';
importScripts('rules.js?v=mc1', 'monte-carlo.js?v=mc1');
async function publishedWeights() {
  try {
    const response = await fetch('modele-9.json?v=mc1');
    if (response.ok) {
      const model = await response.json();
      if (model.size === 9 && model.version === 1 && Array.isArray(model.weights) &&
          model.weights.length === GoridorAI.initialWeights.length && model.weights.every(Number.isFinite)) {
        return model.weights;
      }
    }
  } catch {
    // The built-in evaluator also works if the optional weights cannot be loaded.
  }
  return GoridorAI.initialWeights;
}
self.onmessage = async ({ data }) => {
  const weights = data.size === 9 ? await publishedWeights() : GoridorAI.initialWeights;
  self.postMessage(GoridorAI.search(data, { weights, iterations: 480, budgetMs: 800 }));
};
