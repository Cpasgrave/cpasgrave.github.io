(() => {
  'use strict';

  const profiles = [
    { budgetMs: 350, iterations: 300, width: 6, maxDepth: 5, tacticalDepth: 1 },
    { budgetMs: 800, iterations: 1600, width: 7, maxDepth: 9, tacticalDepth: 2 },
    { budgetMs: 1800, iterations: 18000, width: 8, maxDepth: 15, tacticalDepth: 3 },
    { budgetMs: 3500, iterations: 40000, width: 9, maxDepth: 22, tacticalDepth: 4 },
    { budgetMs: 6000, iterations: 80000, width: 10, maxDepth: 32, tacticalDepth: 5 },
  ].map(Object.freeze);
  const defaultLevel = 3;
  const settings = level => profiles[level - 1] ?? profiles[defaultLevel - 1];
  const levels = { count: profiles.length, defaultLevel, settings };
  if (typeof module === 'object') module.exports = levels;
  else globalThis.TopogoLevels = levels;
})();
