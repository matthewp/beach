import { footer, icons } from '../common.js';

export default function(ctx) {
  let { html } = ctx;
  return html`
    <!doctype html>
    <html lang="en">
    <meta charset="utf-8">
    <title>Beach</title>
    <link rel="stylesheet" href="./styles/site.css">
    <link rel="stylesheet" href="./styles/main.css">
    ${icons(ctx)}
    <main class="container">
      <h1>🏖 Beach</h1>
      <h2>Table of Contents</h2>

      <div class="toc-container">
        <ul class="toc">
          <li><a class="toc-link" href="./routing/">Routing</a></li>
          <li><a class="toc-link" href="./testing/">Testing</a></li>
        </ul>
      </div>
    </main>
    
    ${footer(ctx)}
  `;
}