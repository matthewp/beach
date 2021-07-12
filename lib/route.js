import { lookup, iter } from './deps.js';
import { addEventListener } from './events.js';

const pageMap = new Map();
const mountPoints = new Map();

function page(path, mod) {
  pageMap.set(path, mod);
}

function statics(path, url) {
  const exp = new RegExp(path + '/(.+)');
  mountPoints.set(exp, url);
}

function iteratorToStream(iterator) {
  const encoder =  new TextEncoder();
  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();

      if (done) {
        controller.close();
      } else {
        const chunk = encoder.encode(`${value}\n`);
        controller.enqueue(chunk);
      }
    },
  });
}

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

const pageMethods = new Set(['GET', 'HEAD']);

addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(pageMethods.has(event.request.method)) {
    let match;
    if(pageMap.has(url.pathname)) {
      match = pageMap.get(url.pathname);
      event.respondWith(callPageModule(match, event));
      return;
    } else {
      for(let [exp, mountUrl] of mountPoints) {
        match = exp.exec(url.pathname);
        if(match) {
          const fileUrl = new URL(match[1], mountUrl);
          event.respondWith(fetchFile(fileUrl));
          return;
        }
      }
    }
  }
  event.respondWith(new Response('Not found', {
    status: 404,
    headers: {
      'content-type': 'text/plain'
    }
  }));
});

export default {
  page,
  static: statics
};