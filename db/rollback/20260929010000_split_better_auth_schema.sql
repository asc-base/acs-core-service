-- Run only when rolling the application back to the pre-auth-schema version.
-- The auth tables and their rows are moved back; auth.users is a profile mirror.
BEGIN;

DROP TRIGGER "users_sync_public_email_verified" ON "auth"."users";
DROP FUNCTION "auth"."sync_email_verification_to_public"();
DROP TRIGGER "users_sync_auth_profile" ON "public"."users";
DROP FUNCTION "public"."sync_auth_user_profile"();

ALTER TABLE "auth"."auth_sessions"
    DROP CONSTRAINT "auth_sessions_user_id_fkey",
    ADD CONSTRAINT "auth_sessions_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth"."auth_accounts"
    DROP CONSTRAINT "auth_accounts_user_id_fkey",
    ADD CONSTRAINT "auth_accounts_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth"."auth_sessions" SET SCHEMA "public";
ALTER TABLE "auth"."auth_accounts" SET SCHEMA "public";
ALTER TABLE "auth"."auth_verifications" SET SCHEMA "public";

DROP TABLE "auth"."users";
DROP SCHEMA "auth";

COMMIT;
