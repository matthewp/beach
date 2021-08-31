import { URLPattern } from './deps.js';

export class RouteMatch {
  constructor(opts = {}) {
    this.method = opts.method || null;
    this.pathname = opts.pathname || null;

    switch(typeof opts.pattern) {
      case 'string': {
        this.pattern = new URLPattern({
          pathname: opts.pattern
        });
        break;
      }
      case 'object': {
        this.pattern = opts.pattern;
        break;
      }
      default: {
        this.pattern = null;
      }
    }
  }
}