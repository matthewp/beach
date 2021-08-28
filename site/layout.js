import { header, footer, icons } from './common.js';

export default function(ctx, data) {
  let {html, relative} = ctx;
  return html`
    <!doctype html>
    <html lang="en">
    <meta charset="utf-8">
    <title>${data.title}</title>
    <link rel="stylesheet" href="${relative('/styles/site.css')}">
    <link rel="stylesheet" href="https://unpkg.com/prism-themes@1.8.0/themes/prism-a11y-dark.css">
    ${icons(ctx)}
    ${header(ctx)}
    <article class="doc-content">
      ${data.content}
    </article>
    ${footer(ctx)}
  `;
}