

import '../../lib/shim.js?global';
import { customElements } from '../../lib/dom.js';
import { html } from 'https://unpkg.com/lit-html@1.4.1/lit-html.js';
import { component } from 'https://unpkg.com/haunted@4.8.2/haunted.js';
import { render } from '../../lib/mod.js';
import { consume } from '../helpers.js';
import { assertStringIncludes } from '../deps.js';

Deno.test('Works with Haunted elements', async () => {
  function App() {
    return html`
      <div>testing</div>
    `;
  }
  const AppElement = component(App);
  customElements.define('haunted-app', AppElement);

  let iter = render`<haunted-app></haunted-app>`;
  let out = await consume(iter);
  assertStringIncludes(out, `<div>testing</div>`, 'Rendered the shadow content');
});