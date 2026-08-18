-- Multi-tenant: organizations + organization_id na poslovnim tabelama.
-- Auto-migrate je u lib/db.ts; ovaj fajl je za ručni pokretanje na Aiven-u.

CREATE TABLE IF NOT EXISTS organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  plan VARCHAR(20) NOT NULL DEFAULT 'trial',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  trial_ends_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_organizations_slug (slug)
);

INSERT INTO organizations (name, slug, plan, status, trial_ends_at)
SELECT 'Default', 'default', 'business', 'active', DATE_ADD(UTC_TIMESTAMP(), INTERVAL 365 DAY)
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'default');

ALTER TABLE users ADD COLUMN organization_id INT NULL AFTER id;
ALTER TABLE products ADD COLUMN organization_id INT NULL AFTER id;
ALTER TABLE quotes ADD COLUMN organization_id INT NULL AFTER id;
ALTER TABLE price_lists ADD COLUMN organization_id INT NULL AFTER id;
ALTER TABLE app_settings ADD COLUMN organization_id INT NULL AFTER setting_key;

UPDATE users SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1) WHERE organization_id IS NULL;
UPDATE products SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1) WHERE organization_id IS NULL;
UPDATE quotes SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1) WHERE organization_id IS NULL;
UPDATE price_lists SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1) WHERE organization_id IS NULL;
UPDATE app_settings SET organization_id = (SELECT id FROM organizations WHERE slug = 'default' LIMIT 1) WHERE organization_id IS NULL;
