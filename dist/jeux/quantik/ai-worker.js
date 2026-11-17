"use strict";
importScripts("engine.js", "ai.js");
self.onmessage = ({data}) => {
  self.postMessage(QuantikAI.choose(data.state, data.level));
};
