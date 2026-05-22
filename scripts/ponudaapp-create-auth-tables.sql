-- ============================================================
-- PONUDEAPP — kreiraj NEDOSTAJUĆE tabele za login i sigurnost
-- (Na screenshotu imaš samo: products, quotes, quote_items,
--  price_lists, users — NEMA user_sessions / audit log)
--
-- DataGrip: desni klik na bazu "ponudaapp" → New Query Console
-- Kopiraj SVE ispod → Execute
-- ============================================================

USE ponudaapp;

-- ---------- sesije (obavezno za prijavu) ----------
CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  token_hash CHAR(64) NULL,
  device_label VARCHAR(120) NULL,
  user_agent VARCHAR(512) NULL,
  ip_address VARCHAR(45) NULL,
  geo_city VARCHAR(120) NULL,
  geo_country VARCHAR(120) NULL,
  geo_country_code VARCHAR(8) NULL,
  device_id VARCHAR(36) NULL,
  trust_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  trust_level VARCHAR(10) NOT NULL DEFAULT 'low',
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  session_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_sessions_user (user_id),
  INDEX idx_user_sessions_expires (expires_at),
  INDEX idx_user_sessions_token_hash (token_hash),
  INDEX idx_user_sessions_user_expires (user_id, expires_at),
  INDEX idx_user_sessions_device (user_id, device_id)
);

-- ---------- trust: poznati uređaji ----------
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

-- ---------- rate limit prijave ----------
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash CHAR(64) PRIMARY KEY,
  attempt_count INT NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL,
  locked_until DATETIME NULL,
  INDEX idx_rate_locked (locked_until)
);

-- ---------- audit log (append-only) ----------
CREATE TABLE IF NOT EXISTS security_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
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

-- ---------- podešavanja (logo/firma) ako fali ----------
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  setting_value LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------- indeksi na users ----------
CREATE INDEX idx_users_role_active ON users (role, active);
CREATE INDEX idx_users_email_active ON users (email, active);

-- ============================================================
-- PROVERA (svaki upit treba da vrati bar 1 red / kolone)
-- ============================================================
SHOW TABLES;

SHOW COLUMNS FROM user_sessions LIKE 'trust%';

SHOW TABLES LIKE 'user_known_devices';

SHOW TABLES LIKE 'security_audit_log';
