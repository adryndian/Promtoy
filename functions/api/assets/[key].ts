// Cloudflare Pages Function (Edge Runtime)
// This file handles /api/assets/[key] (GET)

interface Env {
  CF_ACCOUNT_ID: string;
  R2_API_TOKEN: string;
  R2_BUCKET_NAME: string;
  ASSETS_BUCKET?: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const key = params.key as string;

  if (!key) {
      return new Response("Missing key", { status: 400 });
  }

  try {
      if (env.ASSETS_BUCKET) {
          // Use Binding
          const object = await env.ASSETS_BUCKET.get(key);
          if (!object) {
              return new Response("Not Found", { status: 404 });
          }

          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set('etag', object.httpEtag);

          return new Response(object.body, { headers });
      } else {
          // Fallback to REST API
          const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/r2/buckets/${env.R2_BUCKET_NAME}/objects/${key}`;
          const response = await fetch(url, {
              method: 'GET',
              headers: {
                  'Authorization': `Bearer ${env.R2_API_TOKEN}`,
              }
          });

          if (!response.ok) {
              if (response.status === 404) return new Response("Not Found", { status: 404 });
              throw new Error(`R2 Fetch Failed: ${response.status}`);
          }

          // Forward headers
          const headers = new Headers(response.headers);
          // Ensure we stream the body
          return new Response(response.body, { headers });
      }
  } catch (error) {
      console.error("Asset Proxy Error:", error);
      return new Response("Error fetching asset", { status: 500 });
  }
};
