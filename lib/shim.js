import { unshim } from 'https://cdn.spooky.click/ocean/1.2.5/shim.js?global';

const url = new URL(import.meta.url);
if(!url.searchParams.has('global')) {
  unshim();
}

export {
  unshim
};