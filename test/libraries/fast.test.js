import '../../lib/shim.js?global';
import './fast-components-2.2.0.js';
import { render } from '../../lib/mod.js';
import { consume } from '../helpers.js';

Deno.test('Works with FAST', async () => {
  debugger;
  const iter = render`
    <fast-button></fast-button>
  `;
  const out = await consume(iter);
  console.log(out);
})