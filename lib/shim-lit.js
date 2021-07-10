import { LitElementRenderer } from 'https://cdn.spooky.click/lit-labs-ssr-bundle/1.0.0/mod.js';

const root = self[Symbol.for('dom-shim.defaultView')];
const { customElements } = root;
const customElementsDefine = customElements.define;

function * litRender() {
  const instance = new LitElementRenderer(this.localName);
  yield `<${this.localName}`;
  yield `>`;
  yield* instance.renderAttributes();
  const shadowContents = instance.renderShadow({});
  if (shadowContents !== undefined) {
    yield '<template shadowroot="open">';
    yield* shadowContents;
    yield '</template>';
  }
  yield this.innerHTML;
  yield `</${this.localName}>`;
}

function overrideLitElementShim(name, Ctr) {
  if(Ctr._$litElement$) {
    Ctr.prototype.connectedCallback = Function.prototype;
    Ctr.prototype[Symbol.for('beach.serialize')] = litRender;
  }
  return customElementsDefine.apply(this, arguments);
}

Object.defineProperty(customElements, 'define', {
  value: overrideLitElementShim
});