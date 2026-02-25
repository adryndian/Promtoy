CREATE TABLE IF NOT EXISTS ugc_generations (
  id TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now')),
  brand_name TEXT,
  product_type TEXT,
  input_brief TEXT, -- Stores JSON string of the input form data
  output_plan TEXT, -- Stores JSON string of the generated result
  user_id TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
