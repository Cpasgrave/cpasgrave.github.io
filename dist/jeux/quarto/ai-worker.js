importScripts("./engine.js");
self.onmessage = ({ data }) => {
  try {
    self.postMessage(Quarto.chooseAction(data.state, data.level));
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
