import { unshim, domShimSymbol } from 'https://cdn.spooky.click/dom-shim/1.0.0/mod.js?global';
import './shim-lit.js';

const document = self[domShimSymbol].document;
const renderRoot = document.createElement('div');
renderRoot.id = 'beach-render-root';
document.body.appendChild(renderRoot);

const url = new URL(import.meta.url);
if(!url.searchParams.has('global')) {
  unshim();
}