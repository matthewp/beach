import { Ocean } from './deps.js';

const root = self[Symbol.for('dom-shim.defaultView')];
const { document } = root;

const ocean = new Ocean({
  document
});

export const html = ocean.html;