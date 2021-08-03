export function basicCustomElement(customElements, HTMLElement, tagName, shadowText) {
  const YourCustomElement = class extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
      let div = this.ownerDocument.createElement('div');
      div.textContent = shadowText;
      this.shadowRoot.append(div);
    }
  };
  customElements.define(tagName, YourCustomElement);
  return YourCustomElement;
}

export async function consume(iter) {
  let body = '';
  for await(let chunk of iter) {
    body += chunk;
  }
  return body;
}

export function parse(string) {
  const root = self[Symbol.for('dom-shim.defaultView')];
  const DOMParser = root.document.defaultView.DOMParser;

  let parser = new DOMParser();
  let doc = parser.parseFromString(string, 'text/html', {
    includeShadowRoots: true
  });
  return doc;
}