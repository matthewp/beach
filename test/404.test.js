import '../lib/shim.js';
import { Beach } from '../lib/mod.js';
import { assertEquals } from './deps.js';

Deno.test('route.notFound sets a 404 page', async () => {
  let beach = new Beach();
  beach.route.notFound(({ html }) => {
    return html`
      <!doctype html>
      <html lang="en">
      <title>Oops!</title>
    `;
  });
  let response = await beach.handle('/not-exists');
  assertEquals(response.status, 200);

  let html = await response.text();
  let dom = beach.dom(html);
  assertEquals(dom.querySelector('title').textContent, 'Oops!');
});

Deno.test('If route.notFound not set, fallback to server handling', async () => {
  let beach = new Beach();
  let response = await beach.handle('/not-exists');

  assertEquals(response.status, 404);
  let text = await response.text();
  assertEquals(text, 'Not found');
});