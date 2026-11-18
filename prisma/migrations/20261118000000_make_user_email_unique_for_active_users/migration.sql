DROP INDEX "public"."users_email_key";

CREATE UNIQUE INDEX "users_email_active_key"
ON "public"."users"("email")
WHERE "deleted_at" IS NULL;
