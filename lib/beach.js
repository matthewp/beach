/// <reference types="./beach.d.ts" />

import { HydrateLoad, HydrateIdle, HydrateMedia, HydrateVisible, Ocean } from './deps.js';
import { Server } from './events.js';
import { Route } from './route.js';
import { templateShadowRootPolyfillResponse } from './polyfills.js';

export class Beach {
  constructor(opts = {}) {
    const root = self[Symbol.for('dom-shim.defaultView')];

    this.ocean = opts.ocean || new Ocean({
      document: opts.document || root.document,
      hydrationAttr: 'beach-hydrate',
      hydrators: [
        new HydrateLoad(),
        new HydrateIdle('beach-hydrate-idle'),
        new HydrateMedia('beach-hydrate-media', 'beach-query'),
        new HydrateVisible('beach-hydrate-visible')
      ],
      polyfillURL: '/_beach/declarative-shadow-dom.js'
    });
    this.elements = this.ocean.elements;
    this.html = this.ocean.html;

    this.route = new Route();
    this.server = new Server();

    this.route.staticResponse('/_beach/declarative-shadow-dom.js', templateShadowRootPolyfillResponse);

    this.addEventListener = this.server.addEventListener;
    this.startServer = this.startServer.bind(this);
  }

  startServer(...args) {
    this.addEventListener('fetch', this.route.handleFetchEvent);
    this.server.start(...args);
  }
}