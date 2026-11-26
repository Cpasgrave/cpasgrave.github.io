'use strict';
importScripts('rules.js?v=monte-carlo', 'ai-level.js?v=profondeur2', 'ai-reading.js?v=profondeur2', 'monte-carlo.js?v=profondeur2');

self.onmessage = ({ data: { game, level } }) => {
  self.postMessage(TopogoAI.search(game, TopogoLevels.settings(level)));
};
