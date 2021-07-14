import '../lib/shim.js';
import { assertEquals } from './deps.js';
import { html, render } from '../lib/render.js';
import { consume } from './helpers.js';

Deno.test('html handles promises', async () => {
  const iter = html`
    <div>${Promise.resolve(22)}</div>
  `;
  const out = await consume(iter);
  assertEquals(out.trim(), '<div>22</div>');
});

Deno.test('html handles async iterators', async () => {
  async function * getValues() {
    yield 22;
    yield 23;
  }
  async function * each(iter, callback) {
    for await(let value of iter) {
      yield * callback(value);
    }
  }
  let iter = html`
    <ul>
    ${each(getValues(), val => {
      return html`<li>${val}</li>`;
    })}
  </ul>
  `;
  let out = await consume(iter);
  assertEquals(out.trim(), `<ul>
    <li>22</li><li>23</li>
  </ul>`);
});

Deno.test('render handles comments', async () => {
  let iter = render`<div><!-- some comment --></div>`;
  let out = await consume(iter);
  assertEquals(out, `<div><!-- some comment --></div>`);
});

Deno.test('void elements render correctly', async () => {
  let iter = render`<meta name="author" content="Matthew Phillips">`;
  let out = await consume(iter);
  assertEquals(out, `<meta name="author" content="Matthew Phillips">`);

  iter = render`<img src="http://example.com/penguin.png" />`;
  out = await consume(iter);
  assertEquals(out, `<img src="http://example.com/penguin.png">`);
});