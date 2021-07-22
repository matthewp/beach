import { html } from './html.js';

function isPrimitive(val) {
  if (typeof val === 'object') {
    return val === null;
  }
  return typeof val !== 'function';
}

function isThenable(val) {
  return typeof val.then === 'function';
}

export async function * raw(strings, ...values) {
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

export {
  html
};