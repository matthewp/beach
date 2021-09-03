import { urlRelative } from './deps.js';

function redirect(path, status = 302, _headers = {}) {
  let headers = new Headers();
  for(let [name, value] of Object.entries(_headers)) {
    headers.set(name, value);
  }
  headers.set('Location', path);
  return new Response(null, {
    status,
    headers
  });
}

export class Context {
  constructor(event, beach, params) {
    this.event = event;
    this.html = beach.html;
    this.md = beach.md;
    this.params = params || null;
    this.request = this.event.request;
    this.redirect = redirect;
    this.relative = this.relative.bind(this);
  }

  relative(absolutePath) {
    let requestURL = new URL(this.request.url);
    let url = new URL(absolutePath, requestURL);
    let relPath = urlRelative(requestURL, url);
    return relPath;
  }
}