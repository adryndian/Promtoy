// Cloudflare Pages Function (Edge Runtime)
// This file handles /api/upload (POST)

interface Env {
  CF_ACCOUNT_ID: string;
  R2_API_TOKEN: string;
  R2_BUCKET_NAME: string;
  ASSETS_BUCKET?: R2Bucket;
}

async function uploadToR2Rest(env: Env, key: string, content: Uint8Array, contentType: string) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/r2/buckets/${env.R2_BUCKET_NAME}/objects/${key}`;
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${env.R2_API_TOKEN}`,
                'Content-Type': contentType,
            },
            body: content
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`R2 Upload Failed: ${response.status} - ${err}`);
        }
        
        const data = await response.json() as any;
        if (!data.success) {
             throw new Error(`R2 Upload Error: ${data.errors?.[0]?.message}`);
        }

        return data.result;
    } catch (error) {
        console.error("R2 Upload Error:", error);
        throw error;
    }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  
  try {
      const body = await request.json() as any;
      const { filename, contentBase64, contentType } = body;
      
      if (!filename || !contentBase64 || !contentType) {
          return new Response(JSON.stringify({ error: "Missing filename, contentBase64, or contentType" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Decode base64
      const binaryString = atob(contentBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }

      const key = `${Date.now()}-${filename}`;

      if (env.ASSETS_BUCKET) {
          // Use Binding
          await env.ASSETS_BUCKET.put(key, bytes, {
              httpMetadata: { contentType: contentType }
          });
      } else {
          // Fallback to REST API
          await uploadToR2Rest(env, key, bytes, contentType);
      }

      return new Response(JSON.stringify({ success: true, key, url: `/api/assets/${key}` }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
