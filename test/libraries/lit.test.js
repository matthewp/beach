import '../../lib/shim.js?global';
import { LitElement, html as litHtml } from 'https://cdn.skypack.dev/lit@2.0.0-rc.2';
import { html, render } from '../../lib/mod.js';
import { consume } from '../helpers.js';
import { assertStringIncludes } from '../deps.js';

Deno.test('Can render a lit app', async () => {
  class MyElement extends LitElement {
    render() {
      return litHtml`
        <div id="testing">Hello world</div>
      `;
    }
  }
  customElements.define('my-element-test', MyElement);

  const iter = html`
    <div id="outer">
      ${render`<my-element-test></my-element-test>`}
    </div>
  `;

  const out = await consume(iter);
  assertStringIncludes(out, '<div id="testing">Hello world</div>');
});