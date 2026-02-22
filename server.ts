import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Cloudflare D1 Configuration
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || "2472636ad2b8833398abf45b94a93f6d";
const CF_API_TOKEN = process.env.CF_API_TOKEN || "azTPfjWeJOp8j3RY1KLovBVsg2Yu4SRmni6guY-z";
const CF_DATABASE_ID = process.env.CF_DATABASE_ID || "26ebaff4-98b3-41d7-86b";

const D1_API_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}/query`;

// Helper to execute SQL on D1
async function executeD1(sql: string, params: any[] = []) {
  try {
    const response = await fetch(D1_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CF_API_TOKEN}`,
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

    return data.result[0]; // D1 returns results in an array, usually first element is the result set
  } catch (error) {
    console.error("D1 Execution Error:", error);
    throw error;
  }
}

// Initialize Database Table
async function initDb() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS ugc_generations (
      id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now')),
      brand_name TEXT,
      product_type TEXT,
      input_brief TEXT,
      output_plan TEXT,
      user_id TEXT
    );
  `;
  try {
    await executeD1(createTableSQL);
    console.log("Database initialized: ugc_generations table ready.");
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Save Generation
app.post("/api/generations", async (req, res) => {
  const { id, brand_name, product_type, input_brief, output_plan, user_id } = req.body;
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
    await executeD1(sql, [
      id,
      brand_name,
      product_type,
      JSON.stringify(input_brief),
      JSON.stringify(output_plan),
      user_id || 'anonymous'
    ]);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Fetch History
app.get("/api/generations", async (req, res) => {
  const userId = req.query.user_id as string || 'anonymous';
  const sql = `
    SELECT * FROM ugc_generations 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT 20;
  `;
  try {
    const result = await executeD1(sql, [userId]);
    // Parse JSON fields
    const generations = result.results.map((row: any) => ({
      ...row,
      input_brief: JSON.parse(row.input_brief),
      output_plan: JSON.parse(row.output_plan)
    }));
    res.json(generations);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Delete Generation
app.delete("/api/generations/:id", async (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM ugc_generations WHERE id = ?";
  try {
    await executeD1(sql, [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Start Server
async function startServer() {
  // Initialize DB on start
  await initDb();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
