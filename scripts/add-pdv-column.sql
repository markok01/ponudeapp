-- Pokreni jednom na postojećoj bazi: mysql ... ponudaapp < scripts/add-pdv-column.sql
USE ponudaapp;

ALTER TABLE products
  ADD COLUMN pdv_percent DECIMAL(5, 2) NOT NULL DEFAULT 20.00
  AFTER price;
