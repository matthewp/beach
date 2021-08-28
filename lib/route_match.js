
export class RouteMatch {
  constructor(opts = {}) {
    this.method = opts.method || null;
    this.pathname = opts.pathname || null;
    this.pattern = null; // TODO
  }
}