export class ElementMap extends Map {
  constructor(values) {
    super(values);
    this.ready = Promise.resolve();
  }
  add(url) {
    let module = import(url);
    let resolved = module.then(exports => {
      let tagName = exports.tagName;
      if(!tagName) {
        throw new Error(`The element in module ${url.pathname} does not export a \`tagName\`.`);
      }
      this.set(tagName, url);
    });

    this.ready = this.ready.then(resolved);
  }
}

const instance = new ElementMap();
export default instance;