-- Trust score, known devices, immutable audit chain

ALTER TABLE user_sessions ADD COLUMN device_id VARCHAR(36) NULL;
ALTER TABLE user_sessions ADD COLUMN trust_score TINYINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE user_sessions ADD COLUMN trust_level VARCHAR(10) NOT NULL DEFAULT 'low';

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

ALTER TABLE security_audit_log ADD COLUMN action VARCHAR(64) NULL;
ALTER TABLE security_audit_log ADD COLUMN prev_hash CHAR(64) NOT NULL DEFAULT 'GENESIS';
ALTER TABLE security_audit_log ADD COLUMN entry_hash CHAR(64) NULL;
ALTER TABLE security_audit_log ADD COLUMN suspicious_flag TINYINT(1) NOT NULL DEFAULT 0;

UPDATE security_audit_log SET action = event_type WHERE action IS NULL OR action = '';

CREATE INDEX idx_user_sessions_device ON user_sessions (user_id, device_id);
CREATE INDEX idx_audit_suspicious ON security_audit_log (suspicious_flag, created_at);
CREATE INDEX idx_audit_action_created ON security_audit_log (action, created_at);
