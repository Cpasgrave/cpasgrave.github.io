"use strict";
importScripts('engine.js', 'ai.js?v=8-arrivees');
self.onmessage = ({ data }) => {
  try {
    const result = QuoridorAI.choose(data.state, data.level, { trails: data.trails });
    self.postMessage({ id: data.id, ...result });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
