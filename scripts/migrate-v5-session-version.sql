-- mysql -u USER -p ponudaapp < scripts/migrate-v5-session-version.sql
-- Poništava aktivne sesije pri deaktivaciji (session_version u JWT)

USE ponudaapp;

ALTER TABLE users
  ADD COLUMN session_version INT NOT NULL DEFAULT 1 AFTER active;
