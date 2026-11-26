'use strict';
importScripts('rules.js?v=groupes5', 'ai-level.js?v=profondeur2', 'ai-reading.js?v=yeux4', 'monte-carlo.js?v=yeux4');

self.onmessage = ({ data: { game, level } }) => {
  self.postMessage(TopogoAI.search(game, TopogoLevels.settings(level)));
};
