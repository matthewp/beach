# 🏖️ Beach

A little Deno server, with builtin support for server rendering custom elements.

With Beach you get:

* Server-side rendering if custom elements, including shadow DOM thanks to [Declarative Shadow DOM](https://web.dev/declarative-shadow-dom/).
* Automatic inclusion of polyfills for you.
* Partial hydration; only include the JavaScript when needed.

## Usage

### Rendering HTML

Beach exports an `html` function that works a lot like that of [uhtml](https://github.com/WebReflection/uhtml) and [Lit](https://lit.dev/). You give it HTML and can inject values where needed.

Any custom element within your template will have its `connectedCallback` called and the `shadowRoot` will then be serialized inside of `<template shadowroot="open">` tags.

The `html` function returns an [async iterator](https://javascript.info/async-iterators-generators), allowing streaming of HTML.

```js
import { html } from 'https://cdn.spooky.click/beach/0.4.1/mod.js';

const usernamePromise = getUserById(2).then(user => user.name);

const iterator = html`
  <!doctype html>
  <html lang="en">
  <title>My Page!</title>

  <user-profile .userName=${usernamePromise}></user-promise>

  <my-app></my-app>
`;
```

### Syntax

Beach follows the same tagged template literal syntax as libraries like uhtml and Lit. Since Beach is concerned only with rendering HTML there are fewer types of bindings.

You can pass any value to render __text__ or __attributes__. If the value is a promise Beach will await the value.

#### Properties

For custom elements you can pass a property using the dot syntax, for example:

```js
let iterator = html`
  <user-profile .name="Wilbur"></user-profile>
`;
```

This will pass the value to the custom element as a property.

> *Note*: Property bindings do not work for built-in elements. This feature might come in the future.

### Authoring custom elements

```js
import { HTMLElement, customElements } from 'https://cdn.spooky.click/beach/0.4.1/dom.js';

class MyElement extends HTMLElement {
  // ...
}

customElements.define('my-element', MyElement);
```

### Starting a server

```js
import 'https://cdn.spooky.click/beach/0.4.1/shim.js';
import { startServer, route } from 'https://cdn.spooky.click/beach/0.4.1/mod.js';

import * as index from './pages/index.js';

route.page('/', index);

route.static('/styles', new URL('./styles/', import.meta.url));

startServer();
```