import { lookup, iter, pathRelative } from './deps.js';
import { Context } from './context.js';

const pageMethods = new Set(['GET', 'HEAD']);

async function createHTMLResponse(iter) {
  let headers = new Headers();
  headers.set('content-type', 'text/html; charset=utf-8');

  // TODO this should be a stream
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

export async function callPage(fn, event, beach) {
  let context = new Context(event, beach);
  let promise = fn(context);

  let result = await promise;
  if(result instanceof Response) {
    return result;
  }

  return createHTMLResponse(result);
}

async function callPageModule(mod, event, beach) {
  return callPage(mod.default, event, beach);
}

async function callMatch(fn, event, beach, params) {
  let context = new Context(event, beach, params);
  let promise = fn(context);

  let result = await promise;

  if(result instanceof Response) {
    return response;
  } else if(Symbol.asyncIterator in result) {
    return createHTMLResponse(result);
  } else {
    return new Response(null, {
      status: 500
    });
  }
}

function moduleOrFntoModule(moduleOrFn) {
  return typeof moduleOrFn === 'function' ? { default: moduleOrFn } : moduleOrFn;
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

class StaticPath {
  constructor(path) {
    this.path = path;
    this.exp = new RegExp('^' + path + '/(.+)');
  }

  join(part) {
    return this.path + '/' + part;
  }
}

export class Route {
  #pageMap;
  #getMap;
  #mountPoints;
  #staticResponses;
  #matchers;
  #notFoundModule;

  constructor(beach) {
    this.beach = beach;
    this.#pageMap = new Map();
    this.#getMap = new Map();
    this.#mountPoints = new Map();
    this.#staticResponses = new Map();
    this.#matchers = new Map();
    this.#notFoundModule = null;
    this.handleFetchEvent = this.handleFetchEvent.bind(this);
  }

  handleFetchEvent(event) {
    const url = new URL(event.request.url);
    if(pageMethods.has(event.request.method)) {
      let match;
      if(this.#pageMap.has(url.pathname)) {
        match = this.#pageMap.get(url.pathname);
        event.respondWith(callPageModule(match, event, this.beach));
        return;
      } else if(this.#getMap.has(url.pathname)) {
        match = this.#getMap.get(url.pathname);
        event.respondWith(match(new Context(event, this.beach)));
        return;
      } else if(this.#staticResponses.has(url.pathname)) {
        let getResponse = this.#staticResponses.get(url.pathname);
        event.respondWith(getResponse());
        return;
      } else {
        for(let [matcher, fn] of this.#matchers) {
          if(!matcher.pattern) continue;
          let r = matcher.pattern.exec({ pathname: url.pathname });
          if(r) {
            let params = r.pathname.groups;
            event.respondWith(callMatch(fn, event, this.beach, params));
            return;
          }
        }

        for(let [{exp}, mountUrl] of this.#mountPoints) {
          match = exp.exec(url.pathname);
          if(match) {
            const fileUrl = new URL(match[1], mountUrl);
            event.respondWith(fetchFile(fileUrl));
            return;
          }
        }
      }
    }
    
    if(this.#notFoundModule) {
      event.respondWith(callPageModule(this.#notFoundModule, event, this.beach));
      return;
    }
  }

  /* Public API */
  page(path, moduleOrFn) {
    let mod = moduleOrFntoModule(moduleOrFn);
    this.#pageMap.set(path, mod);
  }

  notFound(moduleOrFn) {
    this.#notFoundModule = moduleOrFntoModule(moduleOrFn);
  }

  static(path, url) {
    this.#mountPoints.set(new StaticPath(path), url);
  }

  match(routeMatch, fn) {
    // Fast-path for exact pathname matching
    if(routeMatch.method === 'GET' && routeMatch.pathname) {
      this.#getMap.set(routeMatch.pathname, fn);
    } else {
      this.#matchers.set(routeMatch, fn);
    }
  }

  staticResponse(path, fn) {
    this.#staticResponses.set(path, fn);
  }

  async * #getNames(currentURL) {
    for await (const dirEntry of Deno.readDir(currentURL)) {
      const entryURL = new URL('./' + dirEntry.name, currentURL);
  
      if (dirEntry.isDirectory) {
        entryURL.pathname += '/';
        yield * this.#getNames(entryURL);
      } else {
        yield entryURL;
      }
    }
  }

  async* [Symbol.asyncIterator]() {
    for(let [path] of this.#pageMap) {
      yield path;
    }
    for(let [path] of this.#getMap) {
      yield path;
    }
    for(let [staticPath, dirURL] of this.#mountPoints) {
      for await(let fileURL of this.#getNames(dirURL)) {
        let relPath = pathRelative(dirURL.pathname, fileURL.pathname);
        let path = staticPath.join(relPath);
        yield path;
      }
    }
    // TODO matchers
  }
}