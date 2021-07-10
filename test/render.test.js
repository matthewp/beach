import '../lib/shim.js';
import { assertEquals } from './deps.js';
import { html } from '../lib/render.js';
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
  const iter = html`
    <ul>
    ${each(getValues(), val => {
      return html`<li>${val}</li>`;
    })}
  </ul>
  `;
  const out = await consume(iter);
  assertEquals(out.trim(), `<ul>
    <li>22</li><li>23</li>
  </ul>`);
});