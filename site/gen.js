import { readerFromStreamReader } from 'https://deno.land/std@0.106.0/io/mod.ts';
import { ensureDir } from 'https://deno.land/std@0.106.0/fs/mod.ts';
import { App } from './app.js';

class StaticBuilder {
  constructor({ beach, outDir }) {
    this.beach = beach;
    this.outDir = outDir;
  }

  #getOutURL(response, route) {
    let ct = response.headers.get('content-type');
    let filepath = '';
    if(ct && ct.startsWith('text/html')) {
      filepath = route + 'index.html';
    } else {
      filepath = route;
    }
    return new URL('.' + filepath, this.outDir);
  }

  async build() {
    let app = this.beach;
    for await(let route of app.route) {
      console.error(`Building ${route}`);
      let response = await app.handle(route);
      let bodyReader = response.body.getReader();
      if(bodyReader) {
        let outURL = this.#getOutURL(response, route);
        let outDir = new URL('./', outURL);
        await ensureDir(outDir);
        let r = readerFromStreamReader(bodyReader);
        let file = await Deno.open(outURL.pathname, {
          create: true,
          write: true
        });
        await Deno.copy(r, file);
        file.close();
      }
    }
  }
}

let outDir = new URL('./_dist/', import.meta.url);
let app = new App();

let b = new StaticBuilder({
  beach: app,
  outDir
});

b.build();