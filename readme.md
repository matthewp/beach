# 🏖️ Beach

## Usage

Including an element:

```js
import { HTMLElement, customElements } 'https://cdn.spooky.click/beach/0.1.4/shim.js';

class MyElement extends HTMLElement {
  // ...
}

customElements.define('my-element', MyElement);
```

Starting a server:

```js
import 'https://cdn.spooky.click/beach/0.1.4/shim.js';
import { startServer, route } from 'https://cdn.spooky.click/beach/0.1.4/mod.js';

import * as index from './pages/index.js';

route.page('/', index);

route.static('/styles', new URL('./styles/', import.meta.url));

startServer();
```