CREATE TABLE IF NOT EXISTS panel_users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(80) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  session_id    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  expiry_date   TIMESTAMPTZ,
  plan          VARCHAR(50) NOT NULL DEFAULT 'basic',
  panel_token   UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runtime_events (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES panel_users(id) ON DELETE CASCADE,
  event      VARCHAR(30) NOT NULL,
  message    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_events_user_id ON runtime_events(user_id);
