-- Keep the application's existing users table as Better Auth's user source.
ALTER TABLE "users"
ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "auth_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_accounts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "id_token" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_verifications" (
    "id" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE UNIQUE INDEX "auth_accounts_provider_id_account_id_key" ON "auth_accounts"("provider_id", "account_id");
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications"("identifier");

ALTER TABLE "auth_sessions"
ADD CONSTRAINT "auth_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_accounts"
ADD CONSTRAINT "auth_accounts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Allow Better Auth's native /sign-in/email endpoint to authenticate existing
-- password users immediately. The custom password implementation continues to
-- verify the existing Bun.password hashes.
INSERT INTO "auth_accounts" ("user_id", "account_id", "provider_id", "password")
SELECT "id", "id"::TEXT, 'credential', "password"
FROM "users"
WHERE "password" IS NOT NULL
ON CONFLICT ("provider_id", "account_id") DO NOTHING;
