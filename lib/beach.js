/// <reference types="./beach.d.ts" />

import { HydrateLoad, HydrateIdle, HydrateMedia, HydrateVisible, Ocean, OceanMarkdown, OceanPrism } from './deps.js';
import { Server } from './events.js';
import { Route } from './route.js';
import { templateShadowRootPolyfillResponse } from './polyfills.js';

export class Beach {
  constructor(opts = {}) {
    const root = self[Symbol.for('dom-shim.defaultView')];
    this.document = opts.document || root.document;

    this.ocean = opts.ocean || new Ocean({
      document: this.document,
      hydrationAttr: 'beach-hydrate',
      hydrators: [
        new HydrateLoad(),
        new HydrateIdle('beach-hydrate-idle'),
        new HydrateMedia('beach-hydrate-media', 'beach-query'),
        new HydrateVisible('beach-hydrate-visible')
      ],
      polyfillURL: this.declarativeShadowDomPolyfillPath,
      plugins: [OceanPrism.createInstance]
    });
    this.oceanMarkdown = new OceanMarkdown(this.ocean);
    this.elements = this.ocean.elements;
    this.html = this.ocean.html;
    this.md = this.oceanMarkdown.md;

    this.route = new Route(this);
    this.server = new Server();

    this.route.staticResponse(this.declarativeShadowDomPolyfillPath, templateShadowRootPolyfillResponse);

    this.addEventListener = this.server.addEventListener;
    this.startServer = this.startServer.bind(this);
  }

  get declarativeShadowDomPolyfillPath() {
    return '/_beach/declarative-shadow-dom.js';
  }

  startServer(...args) {
    this.addEventListener('fetch', this.route.handleFetchEvent);
    this.server.start(...args);
  }

  handle(pathOrRequest) {
    let request = pathOrRequest;
    if(typeof pathOrRequest === 'string') {
      let url = new URL(pathOrRequest, this.server.url);
      request = new Request(url, {
        method: 'GET'
      });
    }

    let resolve;
    let responded = false;
    let promise = new Promise(r => { resolve = r; });
    let event = {
      request,
      respondWith(response) {
        responded = true;
        resolve(response);
      }
    };
    this.route.handleFetchEvent(event);
    if(!responded) {
      resolve(new Response('Not found', {
        status: 404,
        headers: {
          'content-type': 'text/plain'
        }
      }));
    }
    return promise;
  }

  dom(htmlStr) {
    let parser = new this.document.defaultView.DOMParser();
    return parser.parseFromString(htmlStr, 'text/html', {
      includeShadowRoots: true
    });
  }
}