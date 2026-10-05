-- Move the optional title reference from professors to users, preserving existing professor data.
ALTER TABLE "users" ADD COLUMN "prefix_id" INTEGER;

UPDATE "users" AS "user"
SET "prefix_id" = professor."academic_position_id"
FROM "professors" AS professor
WHERE professor."user_id" = "user"."id";

ALTER TABLE "professors" DROP CONSTRAINT "professors_academic_position_id_fkey";
ALTER TABLE "professors" DROP COLUMN "academic_position_id";

ALTER TABLE "academic_positions" RENAME TO "prefixes";
ALTER TABLE "users"
ADD CONSTRAINT "users_prefix_id_fkey"
FOREIGN KEY ("prefix_id") REFERENCES "prefixes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "students" DROP COLUMN IF EXISTS "prefix";
