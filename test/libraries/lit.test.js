import '../../lib/shim.js?global';
import { LitElement, html as litHtml } from 'https://cdn.skypack.dev/lit@2.0.0-rc.2';
import { raw, html } from '../../lib/mod.js';
import { consume } from '../helpers.js';
import { assertStringIncludes, assertEquals, parseHTML } from '../deps.js';
import { customElements } from '../../lib/dom.js';

Deno.test('Can render a lit app', async () => {
  class MyElement extends LitElement {
    render() {
      return litHtml`
        <div id="testing">Hello world</div>
      `;
    }
  }
  customElements.define('my-lit-test', MyElement);

  let iter = raw`
    <div id="outer">
      ${html`<my-lit-test></my-lit-test>`}
    </div>
  `;

  let out = await consume(iter);
  assertStringIncludes(out, '<div id="testing">Hello world</div>');
});

Deno.test('Can render lit-element attributes', async () => {
  class MyElement extends LitElement {
    render() {
      return litHtml`<div>testing</div>`;
    }
  }
  customElements.define('lit-element-attrs', MyElement);
  let iter = raw`
    <div>${html`<lit-element-attrs foo="bar" two="three"></lit-element-attrs>`}</div>
  `;
  let out = await consume(iter);
  let { document } = parseHTML(out);
  let el = document.querySelector('lit-element-attrs');
  assertEquals(el.getAttribute('foo'), 'bar');
  assertEquals(el.getAttribute('two'), 'three');
});