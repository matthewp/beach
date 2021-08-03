import '../lib/shim.js';
import { Beach } from '../lib/beach.js';
import { HTMLElement, customElements, document } from '../lib/dom.js';
import { consume, parse } from './helpers.js';
import { assertEquals, assertStringIncludes } from './deps.js';

Deno.test('Polyfill is added', async () => {
  let { html } = new Beach();

  customElements.define('beach-polyfill-el', class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
      let div = document.createElement('div');
      div.textContent = `works`;
      this.shadowRoot.append(div);
    }
  });

  let iter = html`
    <!doctype html>
    <html lang="en">
    <title>My site</title>

    <beach-polyfill-el></beach-polyfill-el>
  `;
  let out = await consume(iter);
  let doc = parse(out);
  assertEquals(doc.querySelectorAll('script').length, 1, 'one script added');

  let script = doc.querySelector('script');
  assertStringIncludes(script.textContent, `import("/_beach/declarative-shadow-dom.js")`);
});