import { unshim } from 'https://cdn.spooky.click/dom-shim/1.0.0/mod.js?global';
import './shim-lit.js';

const url = new URL(import.meta.url);
if(!url.searchParams.has('global')) {
  unshim();
}