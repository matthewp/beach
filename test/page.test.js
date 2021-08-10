import '../lib/shim.js';
import { Beach } from '../lib/mod.js';
import { assert } from './deps.js';

Deno.test({
  name: 'Pages receive the html function',
  async fn() {
    let beach = new Beach();
    beach.route.page('/news', ({ html }) => {
      return html`
        <!doctype html>
        <html lang="en">
        <title>Hello world</title>
        <h1>Hello world</h1>
      `;
    });
    let response = await beach.handle('/news');
    let html = await response.text();
    let dom = beach.dom(html);
    assert(dom.querySelector('h1'));
  }
});