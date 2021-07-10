import '../../lib/shim.js?global';
import register from 'https://cdn.skypack.dev/preact-custom-element@4.2.1';
import { Component, html } from 'https://cdn.skypack.dev/htm@3.1.0/preact';
import { render } from '../../lib/mod.js';
import { consume } from '../helpers.js';
import { assertStringIncludes } from '../deps.js';

Deno.test('preact elements render', async () => {
  class MyComponent extends Component {
    render({ name }) {
      return html`<span>Hello ${name}</span>`;
    }
  }

  register(MyComponent, 'preact-component', ['name'], { shadow: true });

  let iter = render`<preact-component name="World"></preact-component>`;
  let out = await consume(iter);
  assertStringIncludes(out, '<span>Hello World</span>');
});