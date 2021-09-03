---
title: Beach Routing
layout: ../site/layout.js
---

# Routing

Beach's routing is handled through the `route` object on the Beach object. With this you can create routes for pages, link paths to a directory of static assets, or even create matches for any method / URL combination.

## Pages

In Beach a page is a function that returns HTML from the `html` tagged template literal. Using the `beach.route.page()` method to map a path to a page.

```js
async function about() {
  return html`
    <!doctype html>
    <html lang="en">
    <title>My App</title>

    <h1>Welcome to my app!</h1>
  `;
}

let app = new Beach();
app.route.page('/about', about);
```

With Beach you can also use any Markdown file as a page. Use the `markdownPage()` function to point to a markdown file.

```js
let app = new Beach();
app.route.page('/routing/', markdownPage(
  new URL('../docs/routing.md', import.meta.url)
));
```

## Static Assets

To serve static assets from a path, use the `beach.route.static()` method to map a path to a folder.

```js
const app = new Beach();
app.route.static('/images', new URL('./images/', import.meta.url));
```

> Note that the URL should end with a forward-slash, this lets URL resolution work.

## Matching routes

Beach also comes with a lower-level API for matching any given route. `beach.route.match()` allows you to define a method, path, and/or pattern to match again.

If you want to create a route for a non-GET method, use `match()`.

```js
import { Beach, RouteMatch } from 'https://cdn.spooky.click/beach/0.6.3/mod.js';

async function saveTacos({ request }) {
  // TODO save the Tacos in a DB maybe?
}

let app = new Beach();
app.route.match(new RouteMatch({
  method: 'POST',
  pathname: '/tacos'
}), saveTacos);
```

To match a pattern instead, use the `pattern`: property. This is based on the syntax of the [URLPattern proposal](https://web.dev/urlpattern/). You can use this to match patterns for dynamic routes. Here we are implementing a page to show a user page based on the user's database id.

```js
import { Beach, RouteMatch } from 'https://cdn.spooky.click/beach/0.6.3/mod.js';

async function userPage({ html, params }) {
  return html`
    <!doctype html>
    <html lang="en">
    <title>User page</title>

    <h1>Welcome user ${params.id}</h1>
  `;
}

let app = new Beach();
app.route.match(new RouteMatch({
  method: 'GET',
  pattern: '/users/:id'
}), userPage);
```

## Not Found Page

A fall back route can be added to handle the case where no routes matched.

```js
async function notFound({ html, request }) {
  return html`
    <!doctype html>
    <html lang="en">
    <title>Oops</title>

    <h1>Sorry, not found</h1>
    <p>There is no paging matching ${request.url}.</p>
  `;
}

let app = new Beach();
beach.route.notFound(notFound);
```