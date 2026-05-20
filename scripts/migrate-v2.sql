-- Pokrenite jednom na postojećoj bazi: mysql -u root -p ponudaapp < scripts/migrate-v2.sql

USE ponudaapp;

ALTER TABLE products
  ADD COLUMN measure_unit VARCHAR(50) DEFAULT NULL;

ALTER TABLE quotes
  ADD COLUMN note TEXT NULL,
  ADD COLUMN valid_until DATE NULL;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  setting_value LONGTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE price_lists
  ADD COLUMN file_name VARCHAR(255) NULL,
  ADD COLUMN row_count INT NOT NULL DEFAULT 0,
  ADD COLUMN inserted_count INT NOT NULL DEFAULT 0,
  ADD COLUMN updated_count INT NOT NULL DEFAULT 0,
  ADD COLUMN skipped_count INT NOT NULL DEFAULT 0,
  ADD COLUMN removed_count INT NOT NULL DEFAULT 0,
  ADD COLUMN snapshot_json LONGTEXT NULL;
