-- Credentials are now owned exclusively by Better Auth's auth_accounts table.
-- The preceding migration copies all existing users.password hashes before this
-- column is removed.
ALTER TABLE "users" DROP COLUMN "password";
