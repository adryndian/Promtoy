import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Cloudflare D1 Configuration
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || "2472636ad2b8833398abf45b94a93f6d";
const CF_API_TOKEN = process.env.CF_API_TOKEN || "azTPfjWeJOp8j3RY1KLovBVsg2Yu4SRmni6guY-z"; // D1 Token
const CF_DATABASE_ID = process.env.CF_DATABASE_ID || "26ebaff4-98b3-41d7-86b"; // Updated UUID

const D1_API_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}/query`;

// Cloudflare R2 Configuration
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "ugc-assets";
const R2_API_TOKEN = process.env.R2_API_TOKEN || "NHDjdg_-ChJYOhQKq_l0gCp_cA363mnyIW3eIhV"; // R2 Token

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
      // Handle D1 specific error structure
      const errorMsg = data.errors && data.errors.length > 0 ? data.errors[0].message : "Unknown D1 Error";
      throw new Error(`D1 Query Error: ${errorMsg}`);
    }

    // D1 REST API returns results in an array of result sets. 
    // Usually we want the first result set.
    return data.result[0]; 
  } catch (error) {
    console.error("D1 Execution Error:", error);
    throw error;
  }
}

// Helper to upload to R2 via Cloudflare REST API
async function uploadToR2(key: string, content: Buffer, contentType: string) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}/objects/${key}`;
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${R2_API_TOKEN}`,
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

// AWS Polly Proxy
app.post("/api/aws/polly", async (req, res) => {
  const { region, accessKeyId, secretAccessKey, text, voiceId, engine } = req.body;

  if (!region || !accessKeyId || !secretAccessKey || !text || !voiceId) {
    return res.status(400).json({ error: "Missing AWS credentials or parameters" });
  }

  try {
    const client = new PollyClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "mp3",
      VoiceId: voiceId,
      Engine: engine || "neural",
    });

    const response = await client.send(command);
    
    // Convert stream to base64
    const stream = response.AudioStream as any;
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const base64 = buffer.toString("base64");
    
    res.json({ audioContent: base64 });
  } catch (error) {
    console.error("AWS Polly Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// AWS Bedrock Proxy
app.post("/api/aws/bedrock", async (req, res) => {
  const { region, accessKeyId, secretAccessKey, modelId, body } = req.body;

  if (!region || !accessKeyId || !secretAccessKey || !modelId || !body) {
    return res.status(400).json({ error: "Missing AWS credentials or parameters" });
  }

  try {
    const client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify(body),
      contentType: "application/json",
      accept: "application/json",
    });

    const response = await client.send(command);
    const responseBody = new TextDecoder().decode(response.body);
    res.json(JSON.parse(responseBody));
  } catch (error) {
    console.error("AWS Bedrock Error:", error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Upload to R2 Endpoint
app.post("/api/upload", async (req, res) => {
    const { filename, contentBase64, contentType } = req.body;
    
    if (!filename || !contentBase64 || !contentType) {
        return res.status(400).json({ error: "Missing filename, contentBase64, or contentType" });
    }

    try {
        const buffer = Buffer.from(contentBase64, 'base64');
        const key = `${Date.now()}-${filename}`; // Simple unique key
        
        await uploadToR2(key, buffer, contentType);
        
        res.json({ success: true, key, url: `/api/assets/${key}` });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Serve Asset from R2 Proxy
app.get("/api/assets/:key", async (req, res) => {
    const { key } = req.params;
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}/objects/${key}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${R2_API_TOKEN}`,
            }
        });

        if (!response.ok) {
            if (response.status === 404) return res.status(404).send("Not Found");
            throw new Error(`R2 Fetch Failed: ${response.status}`);
        }

        // Forward headers
        const contentType = response.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        
        // Stream body
        // node-fetch body is a Node.js Readable stream
        (response.body as any).pipe(res);

    } catch (error) {
        console.error("Asset Proxy Error:", error);
        res.status(500).send("Error fetching asset");
    }
});

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
