export function footer({html}) {
  return html`
    <footer>
      <hr />
      <p class="acknowledgement">
        Made with <span class="sunglasses">🕶</span> by <a href="https://twitter.com/matthewcp">@matthewcp</a>
      </p>
    </footer>
  `;
}

export function icons({ html, relative }) {
  return html`
    <link rel="apple-touch-icon" sizes="180x180" href="${relative('/images/icons/apple-touch-icon.png')}">
    <link rel="icon" type="image/png" sizes="32x32" href="${relative('/images/icons/favicon-32x32.png')}">
    <link rel="icon" type="image/png" sizes="16x16" href="${relative('/images/icons/favicon-16x16.png')}">
    <link rel="mask-icon" href="${relative('/safari-pinned-tab.svg')}" color="#5bbad5">
    <meta name="msapplication-TileColor" content="#da532c">
    <meta name="theme-color" content="#ffffff">
  `;
}

export function header({html, relative}) {
  return html`
    <header>
      <a href="${relative('/')}" class="beach-logo">Beach 🏖</a>
    </header>
  `;
}