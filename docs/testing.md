---
title: Beach Testing
layout: ../site/layout.js
---

# Testing

__Beach__ is built with testing as a primary concern. You can create instances of your application, handle a request, and check the response using familiar APIs.

The best way to consolidate your app into a testable unit is to make it into a class. We recommend extending `Beach` and defining your routes in the constructor:

__app.js__

```js
import { Beach } from 'https://cdn.spooky.click/beach/0.6.1/mod.js';
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

## beach.handle(requestOrPath)

The __handle__ method on the beach object takes either a [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) object or a string path. It returns a promise that will resolve with a [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response).

To inspect the body of the response, use any of the Response methods, such as `response.text()`.

## beach.dom(htmlStr)

This is a convenience method for testing. It uses the shim's `document` to parse an HTML string into DOM nodes, which you can use to inspect that the HTML response is what you expected.