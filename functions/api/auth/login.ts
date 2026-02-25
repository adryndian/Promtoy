interface Env {
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  CF_DATABASE_ID: string;
  DB?: D1Database;
}

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

    return data.result?.[0] || { results: [] };
  } catch (error) {
    console.error("D1 Execution Error:", error);
    throw error;
  }
}

async function executeD1(env: Env, sql: string, params: any[] = []) {
    if (env.DB) {
        try {
            const stmt = env.DB.prepare(sql).bind(...params);
            const result = await stmt.all();
            return result;
        } catch (e) {
            console.error("D1 Binding Error:", e);
            throw e;
        }
    } else {
        return executeD1Rest(env, sql, params);
    }
}

async function hashPassword(password: string) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  
  try {
      const body = await request.json() as any;
      const { email: rawEmail, password } = body;
      const email = rawEmail?.toLowerCase();

      if (!email || !password) {
          return new Response(JSON.stringify({ error: "Email and password required" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const hashedPassword = await hashPassword(password);
      const sql = `SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND password = ?`;

      const result = await executeD1(env, sql, [email, hashedPassword]);
      const user = result?.results?.[0];

      if (!user) {
          return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, user: { id: user.id, email: user.email } }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
