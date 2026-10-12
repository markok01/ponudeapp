CREATE DATABASE IF NOT EXISTS ponudaapp;
USE ponudaapp;

CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  plan VARCHAR(20) NOT NULL DEFAULT 'trial',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  trial_ends_at DATETIME NULL,
  stripe_customer_id VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  onboarding_completed TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_organizations_slug (slug),
  UNIQUE KEY uk_org_stripe_customer (stripe_customer_id),
  UNIQUE KEY uk_org_stripe_subscription (stripe_subscription_id)
);

INSERT INTO organizations (name, slug, plan, status, trial_ends_at)
SELECT 'Default', 'default', 'business', 'active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 365 DAY)
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'default');

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  price_list_id INT NOT NULL,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  pdv_percent DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
  measure_unit VARCHAR(50) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_products_org_list_sku (organization_id, price_list_id, sku),
  INDEX idx_products_org (organization_id),
  INDEX idx_products_list (price_list_id)
);

CREATE TABLE IF NOT EXISTS quotes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  quote_number VARCHAR(32) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_id INT NULL,
  note TEXT NULL,
  valid_until DATE NULL,
  currency CHAR(3) NOT NULL DEFAULT 'RSD',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_quotes_org_number (organization_id, quote_number),
  INDEX idx_quotes_org (organization_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  tax_id VARCHAR(32) NULL,
  address VARCHAR(500) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customers_org (organization_id),
  INDEX idx_customers_org_name (organization_id, name)
);

CREATE TABLE IF NOT EXISTS quote_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  quote_id INT NOT NULL,
  product_id INT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
  final_price DECIMAL(12, 2) NOT NULL,
  snap_sku VARCHAR(100) NULL,
  snap_name VARCHAR(255) NULL,
  snap_category VARCHAR(100) NULL,
  snap_unit_price DECIMAL(10, 2) NULL,
  snap_pdv_percent DECIMAL(5, 2) NULL,
  snap_measure_unit VARCHAR(50) NULL,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS price_lists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  template VARCHAR(20) NOT NULL DEFAULT 'empty',
  currency CHAR(3) NOT NULL DEFAULT 'RSD',
  file_name VARCHAR(255) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  row_count INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  removed_count INT NOT NULL DEFAULT 0,
  snapshot_json LONGTEXT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived_at DATETIME NULL,
  INDEX idx_price_lists_org (organization_id)
);

CREATE TABLE IF NOT EXISTS org_settings (
  organization_id INT NOT NULL,
  setting_key VARCHAR(64) NOT NULL,
  setting_value LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, setting_key)
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  setting_value LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  active TINYINT(1) NOT NULL DEFAULT 1,
  session_version INT NOT NULL DEFAULT 1,
  email_verified_at DATETIME NULL,
  google_sub VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_org (organization_id),
  UNIQUE KEY uk_users_google_sub (google_sub)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_reset_token_hash (token_hash),
  INDEX idx_reset_user (user_id),
  INDEX idx_reset_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_verify_token_hash (token_hash),
  INDEX idx_verify_user (user_id)
);

CREATE TABLE IF NOT EXISTS org_activity_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  actor_user_id INT NULL,
  actor_email VARCHAR(255) NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(40) NULL,
  entity_id INT NULL,
  summary VARCHAR(500) NOT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_org_activity_org_time (organization_id, created_at),
  INDEX idx_org_activity_action (organization_id, action)
);

CREATE TABLE IF NOT EXISTS ops_health_state (
  check_name VARCHAR(40) PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'unknown',
  fail_streak INT NOT NULL DEFAULT 0,
  last_ok_at DATETIME NULL,
  last_fail_at DATETIME NULL,
  last_alert_at DATETIME NULL,
  last_message VARCHAR(500) NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_invites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organization_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  invited_by INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_invite_token_hash (token_hash),
  INDEX idx_invite_org (organization_id),
  INDEX idx_invite_email (email)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  device_label VARCHAR(120) NULL,
  user_agent VARCHAR(512) NULL,
  ip_address VARCHAR(45) NULL,
  geo_city VARCHAR(120) NULL,
  geo_country VARCHAR(120) NULL,
  geo_country_code VARCHAR(8) NULL,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_sessions_user (user_id),
  INDEX idx_user_sessions_expires (expires_at)
);
