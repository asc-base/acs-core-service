BEGIN;

CREATE SCHEMA IF NOT EXISTS "auth";

CREATE TABLE "auth"."users" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_key" UNIQUE ("email"),
    CONSTRAINT "users_id_fkey" FOREIGN KEY ("id")
        REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "auth"."users" (
    "id", "name", "email", "email_verified", "image", "created_at", "updated_at"
)
SELECT
    "id", "first_name_th", "email", "email_verified", "image_url", "created_at", "updated_at"
FROM "public"."users";

ALTER TABLE "public"."auth_sessions" SET SCHEMA "auth";
ALTER TABLE "public"."auth_accounts" SET SCHEMA "auth";
ALTER TABLE "public"."auth_verifications" SET SCHEMA "auth";

ALTER TABLE "auth"."auth_sessions"
    DROP CONSTRAINT "auth_sessions_user_id_fkey",
    ADD CONSTRAINT "auth_sessions_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth"."auth_accounts"
    DROP CONSTRAINT "auth_accounts_user_id_fkey",
    ADD CONSTRAINT "auth_accounts_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION "public"."sync_auth_user_profile"() RETURNS trigger
    LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO "auth"."users" (
        "id", "name", "email", "email_verified", "image", "created_at", "updated_at"
    ) VALUES (
        NEW."id", NEW."first_name_th", NEW."email", NEW."email_verified",
        NEW."image_url", NEW."created_at", NEW."updated_at"
    )
    ON CONFLICT ("id") DO UPDATE
    SET "name" = EXCLUDED."name",
        "email" = EXCLUDED."email",
        "image" = EXCLUDED."image",
        "updated_at" = EXCLUDED."updated_at";
    RETURN NEW;
END;
$$;

CREATE TRIGGER "users_sync_auth_profile"
    AFTER INSERT OR UPDATE
    ON "public"."users"
    FOR EACH ROW EXECUTE FUNCTION "public"."sync_auth_user_profile"();

CREATE FUNCTION "auth"."sync_email_verification_to_public"() RETURNS trigger
    LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE "public"."users"
    SET "email_verified" = NEW."email_verified"
    WHERE "id" = NEW."id"
      AND "email_verified" IS DISTINCT FROM NEW."email_verified";
    RETURN NEW;
END;
$$;

CREATE TRIGGER "users_sync_public_email_verified"
    AFTER UPDATE OF "email_verified"
    ON "auth"."users"
    FOR EACH ROW EXECUTE FUNCTION "auth"."sync_email_verification_to_public"();

COMMIT;
