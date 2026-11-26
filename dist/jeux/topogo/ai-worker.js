'use strict';
importScripts('rules.js?v=libertes3', 'ai-level.js?v=profondeur2', 'ai-reading.js?v=libertes3', 'monte-carlo.js?v=libertes3');

self.onmessage = ({ data: { game, level } }) => {
  self.postMessage(TopogoAI.search(game, TopogoLevels.settings(level)));
};
