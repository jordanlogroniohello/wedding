export async function onRequest(context) {
  const url = new URL(context.request.url);
  url.pathname = '/theweddingofangelicaandjordan/invitation';

  const req = new Request(url.toString(), { redirect: 'manual' });
  let response = await context.env.ASSETS.fetch(req);

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('Location');
    if (location) {
      const followUrl = new URL(location, url.origin);
      response = await context.env.ASSETS.fetch(followUrl);
    }
  }

  const html = await response.text();

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache'
    }
  });
}
