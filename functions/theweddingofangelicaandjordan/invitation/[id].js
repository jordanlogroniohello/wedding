export async function onRequest(context) {
  const assetUrl = new URL(context.request.url);
  assetUrl.pathname = '/theweddingofangelicaandjordan/invitation';
  const response = await context.env.ASSETS.fetch(assetUrl);
  return new Response(response.body, {
    status: 200,
    headers: response.headers
  });
}
