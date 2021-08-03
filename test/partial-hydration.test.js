import '../lib/shim.js';
import { Beach } from '../lib/beach.js';
import { HTMLElement, customElements, document } from '../lib/dom.js';
import { basicCustomElement, consume, parse } from './helpers.js';
import { assert, assertEquals, assertStringIncludes } from './deps.js';

Deno.test('Load hydrator works', async () => {
  let { html, elements } = new Beach();
  basicCustomElement(customElements, HTMLElement, 'my-load-el', `Load on browser load`);
  elements.set('my-load-el', '/elements/my-load-el.js');
  let iter = html`
    <!doctype html>
    <title>My head</title>
    
    <my-load-el beach-hydrate="load"></my-load-el>
  `;
  let out = await consume(iter);
  let doc = parse(out);
  assertEquals(doc.querySelectorAll('script[src="/elements/my-load-el.js"]').length, 1);
});

Deno.test('Idle hydrator defines the right element', async () => {
  let { html, elements } = new Beach();
  basicCustomElement(customElements, HTMLElement, 'my-idle-el', `Load on idle`);
  elements.set('my-idle-el', '/elements/my-idle-el.js');
  let iter = html`
    <!doctype html>
    <title>My head</title>
    
    <my-idle-el beach-hydrate="idle"></my-idle-el>
  `;
  let out = await consume(iter);
  let doc = parse(out);
  let script = doc.querySelector('script');
  assertStringIncludes(script.textContent, 'beach-hydrate-idle');

  let hydrateEl = doc.querySelector('beach-hydrate-idle');
  assert(hydrateEl);
  assertEquals(hydrateEl.getAttribute('src'), '/elements/my-idle-el.js');
});

Deno.test('Media hydrator works with beach prefixes', async () => {
  let { html, elements } = new Beach();
  basicCustomElement(customElements, HTMLElement, 'my-media-el', `Load on media query`);
  elements.set('my-media-el', '/elements/my-media-el.js');
  let iter = html`
    <!doctype html>
    <title>My head</title>
    
    <my-media-el beach-hydrate="media" beach-query="(max-width: 700px)"></my-media-el>
  `;
  let out = await consume(iter);
  let doc = parse(out);
  let script = doc.querySelector('script');
  assertStringIncludes(script.textContent, 'beach-hydrate-media');

  let hydrateEl = doc.querySelector('beach-hydrate-media');
  assert(hydrateEl, 'hydration element added');
  assertEquals(hydrateEl.getAttribute('query'), '(max-width: 700px)');
  assertEquals(hydrateEl.getAttribute('src'), '/elements/my-media-el.js');
});

Deno.test('Visible hydrator define the right element', async () => {
  let { html, elements } = new Beach();
  basicCustomElement(customElements, HTMLElement, 'my-visible-el', `Load on visible`);
  elements.set('my-visible-el', '/elements/my-visible-el.js');
  let iter = html`
    <!doctype html>
    <title>My head</title>
    
    <my-visible-el beach-hydrate="visible"></my-visible-el>
  `;
  let out = await consume(iter);
  let doc = parse(out);
  let script = doc.querySelector('script');
  assertStringIncludes(script.textContent, 'beach-hydrate-visible');

  let hydrateEl = doc.querySelector('beach-hydrate-visible');
  assert(hydrateEl);
  assertEquals(hydrateEl.getAttribute('src'), '/elements/my-visible-el.js');
});