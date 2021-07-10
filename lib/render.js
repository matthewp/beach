
import { document } from './dom.js';
import { serializeAll } from './serialize.js';

function isPrimitive(val) {
  if (typeof val === 'object') {
    return val === null;
  }
  return typeof val !== 'function';
}

function isThenable(val) {
  return typeof val.then === 'function';
}

export async function * html(strings, ...values) {
  for(let i = 0, len = strings.length; i < len; i++) {
    yield strings[i];
    let value = values[i];
    if(isPrimitive(value) || isThenable(value)) {
      yield (value || '');
    } else {
      yield * value;
    }
  }
}

export function * render(strings, ...values) {
  let raw = String.raw(strings, ...values);
  let root = document.createElement('div');
  document.body.appendChild(root);
  root.innerHTML = raw;
  yield * serializeAll(Array.from(root.childNodes));
  document.body.removeChild(root);
}