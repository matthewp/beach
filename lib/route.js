import { lookup, iter } from './deps.js';

const pageMethods = new Set(['GET', 'HEAD']);

export async function callPage(fn, event) {
  let promise = fn(event);

  let headers = new Headers();
  headers.set('content-type', 'text/html');

  let iter = await promise;
  let content = '';
  for await(let chunk of iter) {
    content += chunk;
  }

  let bytes = new TextEncoder().encode(content);
  headers.set('content-length', bytes.byteLength);

  return new Response(bytes, {
    status: 200,
    headers
  });
}

async function callPageModule(mod, event) {
  return callPage(mod.default, event);
}

async function fetchFile(url) {
  // Open the file, and convert to ReadableStream
  const file = await Deno.open(url, { read: true }).catch((err) => {
    if (err instanceof Deno.errors.NotFound) {
      return undefined;
    } else {
      throw err;
    }
  });
  if (!file) {
    return new Response("404 not found", { status: 404 });
  }
  const body = new ReadableStream({
    start: async (controller) => {
      for await (const chunk of iter(file)) {
        controller.enqueue(chunk.slice(0));
      }
      file.close();
      controller.close();
    },
    cancel() {
      file.close();
    },
  });

  // Get meta information
  const headers = new Headers();
  const contentType = lookup(url.pathname);
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const info = await Deno.stat(url);
  if (info.mtime) {
    headers.set("last-modified", info.mtime.toUTCString());
  }

  // Create 200 streaming response
  const response = new Response(body, { status: 200, headers });
  Object.defineProperty(response, "url", {
    get() {
      return url;
    },
    configurable: true,
    enumerable: true,
  });
  return response;
}

export class Route {
  #pageMap;
  #mountPoints;
  #staticResponses;

  constructor() {
    this.#pageMap = new Map();
    this.#mountPoints = new Map();
    this.#staticResponses = new Map();
    this.handleFetchEvent = this.handleFetchEvent.bind(this);
  }

  handleFetchEvent(event) {
    const url = new URL(event.request.url);
    if(pageMethods.has(event.request.method)) {
      let match;
      if(this.#pageMap.has(url.pathname)) {
        match = this.#pageMap.get(url.pathname);
        event.respondWith(callPageModule(match, event));
        return;
      } else if(this.#staticResponses.has(url.pathname)) {
        let getResponse = this.#staticResponses.get(url.pathname);
        event.respondWith(getResponse());
      } else {
        for(let [exp, mountUrl] of this.#mountPoints) {
          match = exp.exec(url.pathname);
          if(match) {
            const fileUrl = new URL(match[1], mountUrl);
            event.respondWith(fetchFile(fileUrl));
            return;
          }
        }
      }
    }
  }

  /* Public API */
  page(path, mod) {
    this.#pageMap.set(path, mod);
  }

  static(path, url) {
    const exp = new RegExp(path + '/(.+)');
    this.#mountPoints.set(exp, url);
  }

  staticResponse(path, fn) {
    this.#staticResponses.set(path, fn);
  }
}