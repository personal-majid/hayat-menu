-- Run once on the shop PC as the MariaDB admin (root), e.g.:
--   mysql -u root -p < setup_readonly_user.sql
-- Makes a login that can ONLY read. It cannot change or delete anything in VMENU.
-- Replace CHANGE_ME with a password, and put the same password in config.ini.
-- If your VMENU database is not called `vmenu`, change it on the GRANT line.

CREATE USER IF NOT EXISTS 'hayat_sync'@'localhost' IDENTIFIED BY 'CHANGE_ME';
CREATE USER IF NOT EXISTS 'hayat_sync'@'127.0.0.1' IDENTIFIED BY 'CHANGE_ME';
GRANT SELECT ON vmenu.* TO 'hayat_sync'@'localhost';
GRANT SELECT ON vmenu.* TO 'hayat_sync'@'127.0.0.1';
FLUSH PRIVILEGES;
