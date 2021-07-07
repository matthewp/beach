
import { document } from './dom.js';
import { serializeAll } from './serialize.js';

const renderRoot = document.getElementById('beach-render-root');

function clear(node) {
  while(node.lastChild) {
    node.removeChild(node.lastChild);
  }
}

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
  const raw = String.raw(strings, ...values);
  renderRoot.innerHTML = raw;
  const nodes = Array.from(renderRoot.childNodes);
  clear(renderRoot);
  yield * serializeAll(nodes);
}

export function * renderConstructor(Element) {
  const el = new Element();
  el.connectedCallback();
  yield * serialize(el);
}

export function renderConstructorToString(Element) {
  let html = '';
  for(let chunk of render(Element)) {
    html += chunk;
  }
  return html;
}