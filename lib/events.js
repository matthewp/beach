const fetchListeners = new Set();

export function addEventListener(_name, callback) {
  if(_name === 'fetch') {
    fetchListeners.add(callback);
  }
}

async function handle(conn) {
  const httpConn = Deno.serveHttp(conn);
  for await (const requestEvent of httpConn) {
    for(let callback of fetchListeners) {
      callback(requestEvent);
    }
  }
}

async function listen(server) {
  for await (const conn of server) {
    handle(conn);
  }
}

export function startServer() {
  const server = Deno.listen({ port: 8080 });
  console.log(`Listening at http://localhost:${8080}`);
  listen(server);
  return server;
}