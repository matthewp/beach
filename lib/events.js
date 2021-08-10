
export class Server {
  #fetchListeners;
  #hasResponded;

  constructor(opts = {}) {
    this.port = opts.port || 8080;
    this.addEventListener = this.addEventListener.bind(this);

    this.#fetchListeners = new Set();
    this.#hasResponded = Symbol('beach.hasResponded');
  }

  #patchFetchEvent(requestEvent) {
    const hasResponded = this.#hasResponded;
    const respondWith = requestEvent.respondWith;
    Object.defineProperties(requestEvent, {
      [hasResponded]: {
        writable: true,
        value: false
      },
      respondWith: {
        enumerable: false,
        value(...args) {
          this[hasResponded] = true;
          return respondWith.apply(this, args);
        }
      }
    })
  }

  async #listen(server) {
    for await (const conn of server) {
      this.#handle(conn);
    }
  }

  async #handle(conn) {
    let fetchListeners = this.#fetchListeners;
    let httpConn = Deno.serveHttp(conn);
    for await (let requestEvent of httpConn) {
      this.#patchFetchEvent(requestEvent);
      for(let callback of fetchListeners) {
        callback(requestEvent);
      }

      if(!requestEvent[this.#hasResponded]) {
        requestEvent.respondWith(new Response('Not found', {
          status: 404,
          headers: {
            'content-type': 'text/plain'
          }
        }));  
      }  
    }
  }

  get url() {
    return `http://localhost:${this.port}`;
  }

  addEventListener(_name, callback) {
    if(_name === 'fetch') {
      this.#fetchListeners.add(callback);
    }
  }

  start(opts = {}) {
    if(opts.port) {
      this.port = opts.port;
    }
    const server = Deno.listen({ port: this.port });
    console.error(`Listening at ${this.url}`);
    this.#listen(server);
    return server;
  }  
}