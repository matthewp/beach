import { parseFrontmatter } from './deps.js';

function toTemplateStrings(content) {
  let strings = [content];
  strings.raw = strings;
  Object.freeze(strings);
  return strings;
}

async function pageHandler(fileURL, pageRequest) {
  let { md } = pageRequest;
  let mdStr = await Deno.readTextFile(fileURL);
  let { data, content } = parseFrontmatter(mdStr);
  // TODO cache it.
  let strings = toTemplateStrings(content);
  data.content = md(strings);
  let layoutUrl = new URL(data.layout, fileURL);
  let layoutModule = await import(layoutUrl);
  let { default: layout } = layoutModule;
  return layout(pageRequest, data);
}

export function markdownPage(url) {
  return pageHandler.bind(null, url);
}