import { assertEquals } from './deps.js';
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

Deno.test({
  name: 'Streaming integration test',
  ignore: true, // Turn this on to see it go.
  async fn() {
    const wait = () => new Promise(resolve => setTimeout(resolve, 500));
    const render = async function * () {
      yield '<html><body><div><ul>';
      await wait();
      for(let i = 0; i < 10; i++) {
        yield `<li>${i}</li>`;
        await wait();
      }
      yield '</ul></div>';
    };
    const response = await callPage(async () => {
      return render();
    });
    for await(let chunk of response.body) {
      console.log(chunk);
    }
  }
})