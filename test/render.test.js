import '../lib/shim.js';
import { assertEquals, assertStringIncludes } from './deps.js';
import { html, render } from '../lib/render.js';
import { HTMLElement, customElements, document } from '../lib/dom.js';
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

Deno.test('Can render async values in HTML', async () => {
  let iter = render`<div>One ${Promise.resolve(1)}<span>Two ${Promise.resolve(2)}</span></div>`;
  let out = await consume(iter);
  assertEquals(out, `<div>One 1<span>Two 2</span></div>`);
});

Deno.test('Can render async values in components', async () => {
  class MyElement extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
      let h1 = document.createElement('h1');
      h1.textContent = 'My App';
      this.shadowRoot.append(h1);
      this.shadowRoot.append(document.createElement('slot'));
    }
  }
  customElements.define('element-with-async-values', MyElement);
  let iter = render`<element-with-async-values><div id="inner">${Promise.resolve(2)}</div><div id="second">${33}</div></element-with-async-values>`;
  let out = await consume(iter);
  assertStringIncludes(out, '<h1>My App</h1>', 'shadow rendered');
  assertStringIncludes(out, '<div id="inner">2</div>', 'light rendered');
  assertStringIncludes(out, '<div id="second">33</div>', 'second light content');
});

Deno.test('Can provide attributes to custom elements', async () => {
  class MyElement extends HTMLElement {
    static observedAttributes = ['name']
    constructor() {
      super();
      this.attachShadow({ mode: 'open' })
    }
    connectedCallback() {
      let div = document.createElement('div');
      div.textContent = this.getAttribute('name');
      this.shadowRoot.append(div);
    }
  }
  customElements.define('element-with-attrs', MyElement);
  let iter = render`<element-with-attrs name="Matthew"></element-with-attrs>`;
  let out = await consume(iter);
  assertStringIncludes(out, `<div>Matthew</div>`);

  iter = render`<element-with-attrs name="${"Matthew"}"></element-with-attrs>`;
  out = await consume(iter);
  assertStringIncludes(out, `<div>Matthew</div>`);

  iter = render`<element-with-attrs name="${Promise.resolve("Matthew")}"></element-with-attrs>`;
  out = await consume(iter);
  assertStringIncludes(out, `<div>Matthew</div>`);
});

Deno.test('Renders a mix of HTML and custom element', async () => {
  class RandomElement extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
      let el = document.createElement('div');
      el.textContent = 'works';
      this.shadowRoot.append(el);
    }
  }
  customElements.define('html-wc-mix', RandomElement);
  let title = 'Homepage';
  let iter = render`<html><head><title>My page</title><body><h1>Page ${title}</h1><html-wc-mix></html-wc-mix><section id="after"><h1>${Promise.resolve('after')}</h1></section></body>`;
  let out = await consume(iter);

  assertStringIncludes(out, `<h1>Page Homepage</h1>`, 'page title rendered');
  assertStringIncludes(out, `<template shadowroot="open"><div>works</div></template>`, 'ce shadow rendered');
  assertStringIncludes(out, `<section id="after"><h1>after</h1></section>`, 'part after component rendered');
});

Deno.test('Renders boolean attributes', async () => {
  class BooleanElement extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
      let el = document.createElement('div');
      el.id = 'works';
      el.textContent = this.getAttribute('works') === '';
      this.shadowRoot.append(el);
    }
  }
  customElements.define('boolean-attr-el', BooleanElement);
  let iter = render`<div outer><boolean-attr-el works></boolean-attr-el></div>`;
  let out = await consume(iter);
  assertStringIncludes(out, `<div outer>`, 'outer boolean attribute');
  assertStringIncludes(out, `<boolean-attr-el works>`, 'rendered boolean with no value');
  assertStringIncludes(out, `<div id="works">true</div>`, 'shadow rendered');
});