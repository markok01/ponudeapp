-- Pokrenite jednom: mysql -u USER -p ponudaapp < scripts/migrate-v3.sql

USE ponudaapp;

ALTER TABLE quotes
  ADD COLUMN quote_number VARCHAR(32) NULL;

UPDATE quotes
SET quote_number = CONCAT('PON-', YEAR(created_at), '-', LPAD(id, 4, '0'))
WHERE quote_number IS NULL OR quote_number = '';

ALTER TABLE quotes
  MODIFY COLUMN quote_number VARCHAR(32) NOT NULL;

CREATE UNIQUE INDEX idx_quotes_quote_number ON quotes (quote_number);
