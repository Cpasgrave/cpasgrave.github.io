(() => {
  'use strict';

  const profiles = [
    { budgetMs: 350, iterations: 80, width: 6, maxDepth: 4, tacticalDepth: 1 },
    { budgetMs: 800, iterations: 250, width: 7, maxDepth: 7, tacticalDepth: 2 },
    { budgetMs: 1800, iterations: 900, width: 8, maxDepth: 10, tacticalDepth: 2 },
    { budgetMs: 3500, iterations: 2400, width: 9, maxDepth: 15, tacticalDepth: 3 },
    { budgetMs: 6000, iterations: 5500, width: 10, maxDepth: 22, tacticalDepth: 4 },
  ].map(Object.freeze);
  const defaultLevel = 3;
  const settings = level => profiles[level - 1] ?? profiles[defaultLevel - 1];
  const levels = { count: profiles.length, defaultLevel, settings };
  if (typeof module === 'object') module.exports = levels;
  else globalThis.TopogoLevels = levels;
})();
