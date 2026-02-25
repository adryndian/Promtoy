# Cloudflare D1 & R2 Setup Guide

This guide explains how to set up the Cloudflare D1 database and R2 object storage for the UGC Director AI application.

## 1. Prerequisites

- A Cloudflare account.
- `wrangler` CLI installed (`npm install -g wrangler`).
- Node.js installed.

## 2. D1 Database Setup

1.  **Create a D1 Database:**
    ```bash
    wrangler d1 create ugc-db
    ```
    This will output a `database_id`. Copy this ID.

2.  **Initialize the Schema:**
    The application automatically creates the `ugc_generations` table on startup if it doesn't exist.
    However, you can manually execute the schema:
    ```bash
    wrangler d1 execute ugc-db --command "CREATE TABLE IF NOT EXISTS ugc_generations (id TEXT PRIMARY KEY, created_at TEXT DEFAULT (datetime('now')), brand_name TEXT, product_type TEXT, input_brief TEXT, output_plan TEXT, user_id TEXT);"
    ```

## 3. R2 Bucket Setup

1.  **Create an R2 Bucket:**
    ```bash
    wrangler r2 bucket create ugc-assets
    ```

2.  **Enable Public Access (Optional but recommended for assets):**
    Go to the Cloudflare Dashboard -> R2 -> Select Bucket -> Settings -> Public Access -> Connect Domain or Allow Access.
    
    *Note: The current application proxies R2 assets via `/api/assets/:key`, so public access is not strictly required if you use the proxy.*

## 4. API Token Generation

To allow the application (running locally or on a server) to access D1 and R2, you need an API Token.

1.  Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens).
2.  Click **Create Token**.
3.  Use the **"Edit Cloudflare Workers"** template or create a custom token.
4.  **Permissions:**
    -   Account > D1 > Edit
    -   Account > R2 Storage > Edit
    -   Account > Workers R2 Storage > Edit
5.  **Resources:** Include your specific account.
6.  Copy the generated token.

## 5. Configuration

### Local Development (.env)

Update your `.env` file with the following credentials:

```env
CF_ACCOUNT_ID=your_account_id
CF_API_TOKEN=your_api_token
CF_DATABASE_ID=your_d1_database_id
R2_BUCKET_NAME=ugc-assets
R2_API_TOKEN=your_r2_api_token_or_same_as_cf_api_token
```

### Production Deployment (Cloudflare Pages)

1.  **Create `wrangler.toml`:**
    Ensure you have a `wrangler.toml` file in the root directory.

    ```toml
    name = "ugc-director-ai"
    compatibility_date = "2024-09-23"
    pages_build_output_dir = "dist"

    [[d1_databases]]
    binding = "DB"
    database_name = "ugc-db"
    database_id = "your_d1_database_id"

    [[r2_buckets]]
    binding = "ASSETS_BUCKET"
    bucket_name = "ugc-assets"
    ```

2.  **Deploy:**
    ```bash
    npm run build
    wrangler pages deploy dist
    ```

    *Note: For full-stack features (API routes) on Cloudflare Pages, you need to use Cloudflare Pages Functions (`functions/` directory) instead of the Express server (`server.ts`). The `server.ts` is primarily for local development or VPS deployment.*

## 6. Current Integration Status

The application is currently configured to use:
-   **D1 Database ID:** `53d1fdb5-0a08-4067-ad2`
-   **R2 Bucket:** `ugc-assets`
-   **R2 API Token:** Configured in `server.ts` (default) or environment variables.

The `server.ts` file acts as a proxy to Cloudflare services using the REST API, allowing the app to work in any Node.js environment (including local dev and containers).
