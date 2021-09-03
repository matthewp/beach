---
title: Beach Overview
layout: ../site/layout.js
---

# Overview

__Beach__ is a metaframework for web component projects that runs on [Deno](https://deno.land/). With Beach you can:

* Use any (including multiple) web component libraries with automatic server-side rendering. Beach uses [Ocean](https://github.com/matthewp/ocean) under the hood for web component SSR.
* Use [partial hydration](https://docs.astro.build/core-concepts/component-hydration) to only include the client-side JavaScript for components that need it; Beach does not add JavaScript otherwise.
* Write pages in Markdown, or mix and match Markdown with HTML thanks to the md tagged template literal.
* Easy write unit tests for your app with Beach's utilities to make testing easier.

## Creating an app

Beach's main export is the `Beach` class. You can create an instance of it and start adding routes:

```js
import { Beach } from 'https://cdn.spooky.click/beach/0.6.3/mod.js';
import * as welcome from './pages/welcome.js';

let beach = new Beach();
beach.route.page('/', welcome);
```

Since Beach has a big emphasis on [testing](../testing/) we instead recommend *extending* Beach so that the routes are encapsulated in the constructor. This makes writing tests easier; just create an instance of your app.

__app.js__

```js
import { Beach } from 'https://cdn.spooky.click/beach/0.6.3/mod.js';
import * as welcome from './pages/welcome.js';

export class App extends Beach {
  constructor() {
    super();
    this.route.page('/', welcome);
  }
}
```

Beach has methods for creating different types of routes: pages, static content, API routes, and more. See the [routing guide](../routing/) to learn how to set up routes.

## Starting a server

To start Beach call `startServer()` passing in a port to listen on. We recommend creating a new file as the entry point to the server which imports the __App__ class:

__server.js__

```js
import { App } from './app.js';

new App().startServer({ port: 8080 });
```