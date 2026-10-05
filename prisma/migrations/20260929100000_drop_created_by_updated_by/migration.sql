BEGIN;

ALTER TABLE "public"."users"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."user_roles"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."students"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."professors"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."news"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."curriculums"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."courses"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."pre_courses"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."class_books"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."news_features"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."projects"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."project_tags"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."project_members"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

ALTER TABLE "public"."project_courses"
    DROP COLUMN "created_by",
    DROP COLUMN "updated_by";

DO $$
DECLARE
    remaining_columns TEXT;
BEGIN
    SELECT string_agg(
        format('%I.%I.%I', table_schema, table_name, column_name),
        ', '
    )
    INTO remaining_columns
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'auth')
      AND column_name IN ('created_by', 'updated_by');

    IF remaining_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Actor columns remain after migration: %', remaining_columns;
    END IF;
END;
$$;

COMMIT;
