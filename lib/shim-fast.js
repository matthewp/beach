const domShimSymbol = Symbol.for('dom-shim.defaultView');
const { document } = self[domShimSymbol];

// Assign the renderRoot
const renderRoot = document.createElement('div');
renderRoot.id = 'beach-render-root';
document.body.appendChild(renderRoot);

// Additional shims
Object.assign(globalThis, {
  matchMedia: () => {},
  requestAnimationFrame: cb => queueMicrotask(cb),
  ElementStyles: () => {},
  CSSStyleSheet: () => {}
});

Object.assign(document, {
  adoptNode: function(externalNode) {
    externalNode.ownerDocument = this;
  }
});

Object.assign(document.defaultView.HTMLElement.prototype, {
  assignedNodes: function(_opts) {
    return Array.from(this.childNodes);
  }
});

const _style_proto_ = Object.getPrototypeOf(document.createElement('div').style);
Object.assign(_style_proto_, {
  removeProperty: () => {},
  setProperty: () => {}
});

//document.defaultView.CSSStyleDeclaration.prototype.removeProperty = () => {};
