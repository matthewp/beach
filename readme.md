# 🏖️ Beach

A little Deno server, with builtin support for server rendering custom elements.

## Usage

Including an element:

```js
import { HTMLElement, customElements } from 'https://cdn.spooky.click/beach/0.1.6/dom.js';

class MyElement extends HTMLElement {
  // ...
}

customElements.define('my-element', MyElement);
```

Starting a server:

```js
import 'https://cdn.spooky.click/beach/0.1.6/shim.js';
import { startServer, route } from 'https://cdn.spooky.click/beach/0.1.6/mod.js';

import * as index from './pages/index.js';

route.page('/', index);

route.static('/styles', new URL('./styles/', import.meta.url));

startServer();
```