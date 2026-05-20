-- mysql -u USER -p ponudaapp < scripts/migrate-v6-drop-quote-status.sql

USE ponudaapp;

ALTER TABLE quotes DROP COLUMN status;
