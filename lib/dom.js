let domShimSymbol = Symbol.for('dom-shim.defaultView');
let root;

if(domShimSymbol in self) {
  root = self[domShimSymbol];
} else if(typeof self.HTMLElement !== 'undefined') {
  root = self;
} else {
  throw new Error('Oops! You forgot to import the shim.')
}

const {
  HTMLElement,
  customElements,
  document
} = root;

export {
  HTMLElement,
  customElements,
  document
};