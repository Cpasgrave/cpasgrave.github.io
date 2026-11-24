'use strict';
importScripts('rules.js?v=mc2', 'life.js?v=vie1', 'scoring.js?v=vie1', 'lecture.js?v=vie1', 'monte-carlo.js?v=vie1');
async function publishedWeights() {
  try {
    const response = await fetch('modele-9.json?v=vie1');
    if (response.ok) {
      const model = await response.json();
      return GoridorAI.modelWeights(model) ?? GoridorAI.initialWeights;
    }
  } catch {
    // The built-in evaluator also works if the optional weights cannot be loaded.
  }
  return GoridorAI.initialWeights;
}
self.onmessage = async ({ data }) => {
  const weights = data.size === 9 ? await publishedWeights() : GoridorAI.initialWeights;
  self.postMessage(GoridorAI.search(data, { weights, iterations: 2400, budgetMs: 800 }));
};
