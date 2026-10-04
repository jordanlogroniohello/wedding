export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/theweddingofangelicaandjordan/200.html';
  return context.env.ASSETS.fetch(new Request(url, context.request));
}
