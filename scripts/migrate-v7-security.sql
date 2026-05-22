-- Security hardening (pokrenuti jednom na Aiven ako auto-migracija nije primenjena)

ALTER TABLE user_sessions ADD COLUMN token_hash CHAR(64) NULL AFTER id;
ALTER TABLE user_sessions ADD COLUMN last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER last_seen_at;
ALTER TABLE user_sessions ADD COLUMN session_created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_at;

CREATE INDEX idx_user_sessions_token_hash ON user_sessions (token_hash);
CREATE INDEX idx_user_sessions_user_expires ON user_sessions (user_id, expires_at);
CREATE INDEX idx_users_role_active ON users (role, active);
CREATE INDEX idx_users_email_active ON users (email, active);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash CHAR(64) PRIMARY KEY,
  attempt_count INT NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL,
  locked_until DATETIME NULL,
  INDEX idx_rate_locked (locked_until)
);

CREATE TABLE IF NOT EXISTS security_audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  actor_user_id INT NULL,
  target_user_id INT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  failure_reason VARCHAR(255) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_event_created (event_type, created_at),
  INDEX idx_audit_actor_created (actor_user_id, created_at),
  INDEX idx_audit_ip_created (ip_address, created_at)
);
