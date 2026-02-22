// Cloudflare Pages Function (Edge Runtime)
// This file handles /api/generations/[id] (DELETE)

interface Env {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  CF_DATABASE_ID: string;
}

// Helper to execute SQL on D1 via HTTP API (using provided credentials)
async function executeD1(env: Env, sql: string, params: any[] = []) {
  const D1_API_URL = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/query`;

  try {
    const response = await fetch(D1_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as { success: boolean, errors: any[], result: any[] };
    if (!data.success) {
      throw new Error(`D1 Query Error: ${JSON.stringify(data.errors)}`);
    }

    return data.result[0];
  } catch (error) {
    console.error("D1 Execution Error:", error);
    throw error;
  }
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const id = params.id as string;

  const sql = "DELETE FROM ugc_generations WHERE id = ?";

  try {
    await executeD1(env, sql, [id]);
    return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
