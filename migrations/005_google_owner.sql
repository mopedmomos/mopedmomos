-- Retire every legacy password session and administrator. No menu or order data is erased.
DELETE FROM sessions;
DELETE FROM administrators;
ALTER TABLE sessions ADD COLUMN authenticated_at INTEGER NOT NULL DEFAULT 0;
CREATE TABLE owner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),admin_id TEXT NOT NULL UNIQUE,google_sub TEXT NOT NULL UNIQUE,email TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE oauth_flows(state_hash TEXT PRIMARY KEY,nonce TEXT NOT NULL,google_verifier TEXT NOT NULL,app_challenge TEXT NOT NULL,return_uri TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('browser','native')),purpose TEXT NOT NULL CHECK(purpose IN ('login','drive')),admin_id TEXT,expires_at INTEGER NOT NULL);
CREATE TABLE oauth_handoffs(code_hash TEXT PRIMARY KEY,app_challenge TEXT NOT NULL,admin_id TEXT NOT NULL,kind TEXT NOT NULL,purpose TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE google_connections(admin_id TEXT PRIMARY KEY,encrypted_tokens TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE drive_assets(id TEXT PRIMARY KEY,drive_file_id TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL);
ALTER TABLE menu_options ADD COLUMN drive_file_id TEXT;
