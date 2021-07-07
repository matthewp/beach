import { assertEquals } from 'https://deno.land/std@0.100.0/testing/asserts.ts';
import { callPage } from '../lib/route.js';

async function readBody(response) {
  let body = '';
  for await(let chunk of response.body) {
    body += chunk;
  }
  return body;
}

Deno.test('callPage can take an async generator', async () => {
  const response = await callPage(async function * () {
    yield '<html>';
    yield '<body>';
    yield '<div>';
    yield 'test'
    yield '</div>';
  });

  const text = await readBody(response);
  assertEquals(text, '<html><body><div>test</div>');
});

Deno.test('callPage can take a generate', async () => {
  const response = await callPage(function * () {
    yield '<html>';
    yield '<body>';
    yield '<div>';
    yield 'test'
    yield '</div>';
  });

  const text = await readBody(response);
  assertEquals(text, '<html><body><div>test</div>');
});

Deno.test('callPage can take a function that returns an async generator', async () => {
  const render = async function * () {
    yield '<html>';
    yield '<body>';
    yield '<div>';
    yield 'test'
    yield '</div>';
  };
  const response = await callPage(async () => {
    return render();
  });

  const text = await readBody(response);
  assertEquals(text, '<html><body><div>test</div>');
});