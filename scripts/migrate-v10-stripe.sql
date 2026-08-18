-- Stripe billing columns + webhook event log
ALTER TABLE organizations
  ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER trial_ends_at;
ALTER TABLE organizations
  ADD COLUMN stripe_subscription_id VARCHAR(255) NULL AFTER stripe_customer_id;

CREATE UNIQUE INDEX uk_org_stripe_customer ON organizations (stripe_customer_id);
CREATE UNIQUE INDEX uk_org_stripe_subscription ON organizations (stripe_subscription_id);

CREATE TABLE IF NOT EXISTS stripe_events (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(80) NOT NULL,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
