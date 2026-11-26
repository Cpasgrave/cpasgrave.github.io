(() => {
  'use strict';

  const profiles = Object.freeze([
    Object.freeze({budgetMs:350, rollout:1}),
    Object.freeze({budgetMs:800, rollout:2}),
    Object.freeze({budgetMs:1800, rollout:2}),
    Object.freeze({budgetMs:3500, rollout:3}),
    Object.freeze({budgetMs:6000, rollout:3}),
  ]);
  const defaultLevel = 3;

  function settings(level) {
    return profiles[level - 1] ?? profiles[defaultLevel - 1];
  }

  const api = {count:profiles.length, defaultLevel, settings};
  if (typeof module === 'object') module.exports = api;
  else globalThis.GoridorLevels = api;
})();
