export async function consume(iter) {
  let body = '';
  for await(let chunk of iter) {
    body += chunk;
  }
  return body;
}