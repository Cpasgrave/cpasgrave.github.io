"use strict";
importScripts('engine.js', 'ai.js');
self.onmessage = ({ data }) => {
  try {
    const result = QuoridorAI.choose(data.state, data.level, { history: data.history });
    self.postMessage({ id: data.id, ...result });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
