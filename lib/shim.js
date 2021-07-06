import { parseHTML } from 'https://unpkg.com/linkedom@0.11.0/worker.js';

const { HTMLElement, document, customElements } = parseHTML(`
  <html lang="en">
  <head><title>test</title></head>
  <body><div id="beach-render-root"></div></body>
  </html>
`);

self.BeachDOM = {
  HTMLElement,
  customElements,
  document
};

export function shimGlobal() {
  Object.assign(self, self.BeachDOM);
}