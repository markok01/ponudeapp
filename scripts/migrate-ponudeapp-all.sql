-- ============================================================
-- PONUDEAPP — jednokratna migracija (Aiven MySQL)
-- Baza: ponudaapp  (NE defaultdb)
-- Gde: Aiven → Query editor → izaberi bazu "ponudaapp" → Paste → Run
-- ============================================================
-- Ako neka linija padne sa "Duplicate column" ili "Duplicate key" —
-- to znači da već postoji; preskoči tu liniju i nastavi.
-- ============================================================

-- ---------- user_sessions (sesije + trust) ----------
ALTER TABLE user_sessions ADD COLUMN device_label VARCHAR(120) NULL;
ALTER TABLE user_sessions ADD COLUMN user_agent VARCHAR(512) NULL;
ALTER TABLE user_sessions ADD COLUMN ip_address VARCHAR(45) NULL;
ALTER TABLE user_sessions ADD COLUMN geo_city VARCHAR(120) NULL;
ALTER TABLE user_sessions ADD COLUMN geo_country VARCHAR(120) NULL;
ALTER TABLE user_sessions ADD COLUMN geo_country_code VARCHAR(8) NULL;
ALTER TABLE user_sessions ADD COLUMN token_hash CHAR(64) NULL;
ALTER TABLE user_sessions ADD COLUMN last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_sessions ADD COLUMN session_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE user_sessions ADD COLUMN device_id VARCHAR(36) NULL;
ALTER TABLE user_sessions ADD COLUMN trust_score TINYINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE user_sessions ADD COLUMN trust_level VARCHAR(10) NOT NULL DEFAULT 'low';

-- ---------- poznati uređaji (trust score) ----------
CREATE TABLE IF NOT EXISTS user_known_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  device_id VARCHAR(36) NOT NULL,
  device_label VARCHAR(120) NULL,
  last_ip VARCHAR(45) NULL,
  last_country_code VARCHAR(8) NULL,
  success_login_count INT NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_device (user_id, device_id),
  INDEX idx_known_devices_user (user_id)
);

-- ---------- rate limit (login) ----------
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash CHAR(64) PRIMARY KEY,
  attempt_count INT NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL,
  locked_until DATETIME NULL,
  INDEX idx_rate_locked (locked_until)
);

-- ---------- audit log (ako tabele još nema) ----------
CREATE TABLE IF NOT EXISTS security_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL DEFAULT '',
  actor_user_id INT NULL,
  target_user_id INT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  failure_reason VARCHAR(255) NULL,
  metadata JSON NULL,
  prev_hash CHAR(64) NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
  entry_hash CHAR(64) NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000',
  suspicious_flag TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_event_created (event_type, created_at),
  INDEX idx_audit_action_created (action, created_at),
  INDEX idx_audit_actor_created (actor_user_id, created_at),
  INDEX idx_audit_ip_created (ip_address, created_at),
  INDEX idx_audit_suspicious (suspicious_flag, created_at)
);

-- ---------- audit log (ako tabela već postoji starija verzija) ----------
ALTER TABLE security_audit_log ADD COLUMN action VARCHAR(64) NULL;
ALTER TABLE security_audit_log ADD COLUMN prev_hash CHAR(64) NOT NULL DEFAULT '0000000000000000000000000000000000000000000000000000000000000000';
ALTER TABLE security_audit_log ADD COLUMN entry_hash CHAR(64) NULL;
ALTER TABLE security_audit_log ADD COLUMN suspicious_flag TINYINT(1) NOT NULL DEFAULT 0;

UPDATE security_audit_log
SET action = event_type
WHERE action IS NULL OR action = '';

UPDATE security_audit_log
SET entry_hash = '0000000000000000000000000000000000000000000000000000000000000000'
WHERE entry_hash IS NULL OR entry_hash = '';

-- ---------- indeksi ----------
CREATE INDEX idx_user_sessions_token_hash ON user_sessions (token_hash);
CREATE INDEX idx_user_sessions_user_expires ON user_sessions (user_id, expires_at);
CREATE INDEX idx_user_sessions_device ON user_sessions (user_id, device_id);
CREATE INDEX idx_users_role_active ON users (role, active);
CREATE INDEX idx_users_email_active ON users (email, active);

-- ============================================================
-- Gotovo. Provera (opciono):
-- SHOW TABLES LIKE '%session%';
-- SHOW TABLES LIKE 'security_audit%';
-- SHOW COLUMNS FROM user_sessions LIKE 'trust%';
-- ============================================================
