import { GeneratedAsset, FormData } from '../../types';

// Cloudflare Pages Function (Edge Runtime)
// This file handles /api/generations (GET, POST)

interface Env {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  CF_DATABASE_ID: string;
  DB?: D1Database;
}

// Helper to execute SQL on D1 via HTTP API (using provided credentials)
async function executeD1Rest(env: Env, sql: string, params: any[] = []) {
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
      const errorMsg = data.errors && data.errors.length > 0 ? data.errors[0].message : "Unknown D1 Error";
      throw new Error(`D1 Query Error: ${errorMsg}`);
    }

    return data.result[0];
  } catch (error) {
    console.error("D1 Execution Error:", error);
    throw error;
  }
}

async function executeD1(env: Env, sql: string, params: any[] = []) {
    if (env.DB) {
        // Use Binding
        try {
            const stmt = env.DB.prepare(sql).bind(...params);
            const result = await stmt.all();
            return result;
        } catch (e) {
            console.error("D1 Binding Error:", e);
            throw e;
        }
    } else {
        // Fallback to REST API
        return executeD1Rest(env, sql, params);
    }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id') || 'anonymous';

  const sql = `
    SELECT * FROM ugc_generations 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 20;
  `;

  try {
    const result = await executeD1(env, sql, [userId]);
    // Parse JSON fields
    const generations = result.results.map((row: any) => ({
      ...row,
      input_brief: typeof row.input_brief === 'string' ? JSON.parse(row.input_brief) : row.input_brief,
      output_plan: typeof row.output_plan === 'string' ? JSON.parse(row.output_plan) : row.output_plan
    }));
    return new Response(JSON.stringify(generations), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const body = await request.json() as any;
  const { id, brand_name, product_type, input_brief, output_plan, user_id } = body;

  const sql = `
    INSERT INTO ugc_generations (id, brand_name, product_type, input_brief, output_plan, user_id)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      brand_name = excluded.brand_name,
      product_type = excluded.product_type,
      input_brief = excluded.input_brief,
      output_plan = excluded.output_plan,
      user_id = excluded.user_id;
  `;

  try {
    await executeD1(env, sql, [
      id,
      brand_name,
      product_type,
      JSON.stringify(input_brief),
      JSON.stringify(output_plan),
      user_id || 'anonymous'
    ]);
    return new Response(JSON.stringify({ success: true, id }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
