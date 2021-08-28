# 🏖️ Beach

A little Deno server, with builtin support for server rendering custom elements.

With Beach you get:

* Server-side rendering if custom elements, including shadow DOM thanks to [Declarative Shadow DOM](https://web.dev/declarative-shadow-dom/).
* Automatic inclusion of polyfills for you.
* Partial hydration; only include the JavaScript when needed.

## Usage

### Rendering HTML

Beach includes an `html` function that works a lot like that of [uhtml](https://github.com/WebReflection/uhtml) and [Lit](https://lit.dev/). You give it HTML and can inject values where needed.

Any custom element within your template will have its `connectedCallback` called and the `shadowRoot` will then be serialized inside of `<template shadowroot="open">` tags.

The `html` function returns an [async iterator](https://javascript.info/async-iterators-generators), allowing streaming of HTML. This function is passed into routes, no need to import separately.

```js
export default function({ html }) {
  let usernamePromise = getUserById(2).then(user => user.name);

  return html`
    <!doctype html>
    <html lang="en">
    <title>My Page!</title>

    <user-profile .username=${usernamePromise}></user-promise>

    <my-app></my-app>
  `;
}
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
import { HTMLElement, customElements } from 'https://cdn.spooky.click/beach/0.5.0/dom.js';

class MyElement extends HTMLElement {
  // ...
}

customElements.define('my-element', MyElement);
```

### Starting a server

Create an instance of a `Beach`, add some routes and start the server.

```js
import 'https://cdn.spooky.click/beach/0.5.0/shim.js';
import { Beach } from 'https://cdn.spooky.click/beach/0.5.0/mod.js';
import * as index from './pages/index.js';

const { route, startServer } = new Beach();

route.page('/', index);
route.static('/styles', new URL('./styles/', import.meta.url));

startServer();
```

## Testing

Beach is built with testing as a primary concern. You can create instances of your application, handle a request, and check the response using familiar APIs.

The best way to consolidate your app into a testable unit is to make it into a class. We recommend extending `Beach` and defining your routes in the constructor:

__app.js__

```js
import { Beach } from 'https://cdn.spooky.click/beach/0.5.0/mod.js';
import * as newsPage from './pages/news.js';

export class App extends Beach {
  constructor() {
    super();

    this.route.page('/news', newsPage);
  }
}
```

In your server entrypoint, create an instance of this class and call `startServer`:

__server.js__

```js
import { App } from './app.js';

new App().startServer();
```

In your tests you can create an instance of your app as well, but this time instead of starting the server, call `handle` to handle a request:

__test/news.test.js__

```js
import { App } from '../lib/app.js';
import { assertEquals } from './deps.js';

Deno.test('News page creates the right content', async () => {
  let app = new App();
  let response = await app.handle('/news');
  let html = await response.text();

  let dom = beach.dom(html);
  assertEquals(dom.querySelector('h1').textContent, 'News Page');
});
```

### beach.handle(requestOrPath)

The __handle__ method on the beach object takes either a [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) object or a string path. It returns a promise that will resolve with a [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response).

To inspect the body of the response, use any of the Response methods, such as `response.text()`.

### beach.dom(htmlStr)

This is a convenience method for testing. It uses the shim's `document` to parse an HTML string into DOM nodes, which you can use to inspect that the HTML response is what you expected.