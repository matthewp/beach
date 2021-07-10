import '../../lib/shim.js?global';
import 'https://unpkg.com/@microsoft/fast-components@2.2.0/dist/fast-components.js';
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