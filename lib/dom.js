let root;

if(self.BeachDOM) {
  root = self.BeachDOM;
} else if(typeof HTMLElement !== 'undefined') {
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