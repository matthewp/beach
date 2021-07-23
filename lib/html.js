import { document, customElements } from './dom.js';
import { serialize } from './serialize.js';
import { nonClosingElements } from './shared.js';

const templateCache = new Map();
const prefix = 'ḇeach';
const commentPlaceholder = `<!--${prefix}-->`;

function isPrimitive(val) {
  if (typeof val === 'object') {
    return val === null;
  }
  return typeof val !== 'function';
}

function isThenable(val) {
  return typeof val.then === 'function';
}

function * iterable(value) {
  if(isPrimitive(value) || isThenable(value)) {
    yield (value || '');
  } else {
    yield * value;
  }
}

class TextBinding {
  set(node, val) {
    node.data = val;
  }
}

class AttributeBinding {
  constructor(name) {
    this.name = name;
  }
  set(node, val) {
    node.setAttribute(this.name, val);
  }
}

class Part {
  constructor(start, end) {
    this.start = start;
    this.end = end;
  }
}

class TextPart extends Part {
  constructor(text, start, end) {
    super(start, end);
    this.text = text;
  }

  addDoctype(doctype) {
    this.text = doctype.replace(this.text);
  }

  async * render(values) {
    yield this.text;
    for(let value of values) {
      yield * iterable(value);
    }
  }
}

class ComponentPart {
  constructor(node, state) {
    let start = state.i;
    this.node = node;
    this.start = start;
    this.bindings = new Map();
    this.hasBindings = false;
    this.process(node, state);
    this.end = state.i;
  }
  process(node, state) {
    let bindings = this.bindings;
    
    let walker = document.createTreeWalker(node, 133, null, false);
    let currentNode = node;
    let index = 0;
    while(currentNode) {
      switch(currentNode.nodeType) {
        case 1: {
          for(let attr of currentNode.attributes) {
            if(attr.value === commentPlaceholder) {
              bindings.set(index, new AttributeBinding(attr.name));
              state.i++;
              this.end++;
            }
          }
          break;
        }
        case 8: {
          if(currentNode.data === prefix) {
            currentNode.replaceWith(document.createTextNode(''));
            bindings.set(index, new TextBinding());
            state.i++;
            this.end++;
          }
          break;
        }
      }
      index++;
      currentNode = walker.nextNode();
    }
    this.hasBindings = this.bindings.size > 0;
  }
  async hydrate(values) {
    let resolved = await Promise.all(values);
    let el = this.node.cloneNode(true);

    if(this.hasBindings) {
      let bindings = this.bindings;
      let walker = document.createTreeWalker(el, -1);
      let currentNode = el;
      let index = 0;
      let valueIndex = 0;
  
      while(currentNode) {
        if(bindings.has(index)) {
          let value = resolved[valueIndex];
          bindings.get(index).set(currentNode, value);
          valueIndex++;
        }
        index++;
        currentNode = walker.nextNode();
      }
    }

    return el;
  }
  async * render(values) {
    let el = await this.hydrate(values);
    document.body.appendChild(el);
    yield * serialize(el);
    document.body.removeChild(el);
  }
}

class Template {
  constructor(parts) {
    this.parts = parts;
  }
  async * render(values) {
    let i = 0, j = 0;

    let parts = this.parts,
      pLen = parts.length;

    for(let part of parts) {
      let partValues = values.slice(part.start, part.end);
      yield * part.render(partValues);
    }
  }
}

class Doctype {
  constructor(raw) {
    this.raw = raw;
    this.match = /(<!doctype html>)/i.exec(raw);
    this.source = this.match ? this.match[0] : null;
    this.start = this.match ? this.match.index : null;
    this.end = this.match ? this.match.index + this.source.length : null;
  }
  remove() {
    if(!this.match) {
      return this.raw;
    }
    return this.raw.slice(0, this.start) + this.raw.slice(this.end);
  }
  replace(part) {
    if(!this.match) {
      return part;
    }
    return part.slice(0, this.start) + this.source + part.slice(this.start);
  }
}

function htmlValue(htmlStr) {
  return {
    type: 'html',
    value: htmlStr
  };
}

function * walkFragment(frag, state) {
  for(let node of frag.childNodes) {
    yield * walk(node, state);
  }
}

function * walkElement(node, state) {
  if(customElements.get(node.localName)) {
    yield {
      type: 'component',
      value: node
    }
    return;
  }

  yield htmlValue(`<${node.localName}`);
  for(let {name, value} of node.attributes) {
    if(value === '') {
      yield htmlValue(` ${name}`);
    } else {
      yield htmlValue(` ${name}="${value}"`);
    }
  }
  yield htmlValue(`>`);
  for(let child of node.childNodes) {
    yield * walk(child, state);
  }
  if(!nonClosingElements.has(node.localName)) {
    yield htmlValue(`</${node.localName}>`);
  }
}

function * walk(entryNode, state) {
  let node = entryNode;

  switch(node.nodeType) {
    case 1: {
      yield * walkElement(node, state);
      break;
    }
    case 3: {
      yield htmlValue(node.data);
      break;
    }
    case 8: {
      if(node.data === prefix) { 
        yield {
          type: 'hole'
        };
        state.i++;
      } else {
        yield htmlValue(`<!--${node.data}-->`);
      }
      
      break;
    }
    case 11: {
      yield * walkFragment(node, state);
      break;
    }

  }
}

function compile(parts, values) {
  let replacedValues = Array.from({ length: values.length }, _ => commentPlaceholder);
  let raw = String.raw(parts, ...replacedValues);
  let doctype = new Doctype(raw);
  raw = doctype.remove();

  let div = document.createElement('div');
  div.innerHTML = raw;
  let frag = document.createDocumentFragment();
  frag.append(...div.childNodes);

  let templates = [];
  let buffer = '';
  let state = { i: 0, li: 0 };
  for(let { type, value } of walk(frag, state)) {
    switch(type) {
      case 'html': {
        buffer += value;
        break;
      }
      case 'hole': {
        templates.push(new TextPart(buffer, state.i, state.i + 1));
        buffer = '';
        break;
      }
      case 'component': {
        if(buffer) {
          templates.push(new TextPart(buffer, state.li, state.i));
          buffer = '';
        }
        templates.push(new ComponentPart(value, state));
        break;
      }
    }
    state.li = state.i;
  }
  if(buffer) {
    templates.push(new TextPart(buffer, state.i + 1));
  }

  if(doctype.match && templates[0] instanceof TextPart) {
    templates[0].addDoctype(doctype);
  }

  return new Template(templates);
}

export async function * html(strings, ...values) {
  let template;
  if(templateCache.has(strings)) {
    template = templateCache.get(strings);
  } else {
    template = compile(strings, values);
    templateCache.set(strings, template);
  }

  yield * template.render(values);
}