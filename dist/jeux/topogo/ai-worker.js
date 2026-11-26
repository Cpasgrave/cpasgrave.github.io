'use strict';
importScripts('rules.js?v=monte-carlo', 'ai-level.js?v=monte-carlo', 'ai-reading.js?v=monte-carlo', 'monte-carlo.js?v=monte-carlo');

self.onmessage = ({ data: { game, level } }) => {
  self.postMessage(TopogoAI.search(game, TopogoLevels.settings(level)));
};
