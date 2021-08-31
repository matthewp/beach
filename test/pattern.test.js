import '../lib/shim.js';
import { Beach, RouteMatch } from '../lib/mod.js';
import { assertEquals } from './deps.js';

Deno.test({
  name: 'Pattern can be provided',
  async fn() {
    let beach = new Beach();
    let pattern = new RouteMatch({
      method: 'GET',
      pattern: '/users/:id'
    });
    beach.route.match(pattern, async ({ html, params }) => {
      return html`<div>user: ${params.id}</div>`;
    });
    let response = await beach.handle('/users/12');
    let html = await response.text();

    assertEquals(response.status, 200);
    assertEquals(html, `<div>user: 12</div>`);
  }
});