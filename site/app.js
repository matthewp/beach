import '../lib/shim.js';
import { Beach, markdownPage } from '../lib/mod.js';
import * as index from './pages/index.js';

export class App extends Beach {
  constructor() {
    super();
    this.route.page('/', index);
    this.route.page('/routing/', markdownPage(new URL('../docs/routing.md', import.meta.url)));
    this.route.static('/styles', new URL('./styles/', import.meta.url));
    this.route.static('/images', new URL('./images/', import.meta.url));
  }
}