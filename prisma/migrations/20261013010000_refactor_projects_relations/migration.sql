CREATE TYPE "public"."project_member_type" AS ENUM ('STUDENT', 'ADVISOR', 'CO_ADVISOR');

ALTER TABLE "public"."projects" RENAME COLUMN "details" TO "detail";
ALTER TABLE "public"."projects" DROP COLUMN "thumbnail_url";
ALTER TABLE "public"."projects" DROP COLUMN "assets_url";
ALTER TABLE "public"."projects" DROP COLUMN "tech_stacks";

ALTER TABLE "public"."project_members" ADD COLUMN "member_type" "public"."project_member_type";
ALTER TABLE "public"."project_members" ADD COLUMN "position" TEXT;

UPDATE "public"."project_members" AS project_member
SET "member_type" = CASE lower(r."name")
  WHEN 'student' THEN 'STUDENT'::"public"."project_member_type"
  WHEN 'professor' THEN 'ADVISOR'::"public"."project_member_type"
  ELSE NULL
END
FROM "public"."roles" AS r
WHERE r."id" = project_member."role_id";

ALTER TABLE "public"."project_members" ALTER COLUMN "member_type" SET NOT NULL;
ALTER TABLE "public"."project_members" DROP COLUMN "role_id";

CREATE TABLE "public"."tech_stacks" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "tech_stacks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tech_stacks_name_key" ON "public"."tech_stacks"("name");

CREATE TABLE "public"."project_tech_stacks" (
  "id" SERIAL NOT NULL,
  "project_id" INTEGER NOT NULL,
  "tech_stack_id" INTEGER NOT NULL,
  CONSTRAINT "project_tech_stacks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_tech_stacks_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "project_tech_stacks_tech_stack_id_fkey"
    FOREIGN KEY ("tech_stack_id") REFERENCES "public"."tech_stacks"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "project_tech_stacks_project_id_idx" ON "public"."project_tech_stacks"("project_id");
CREATE INDEX "project_tech_stacks_tech_stack_id_idx" ON "public"."project_tech_stacks"("tech_stack_id");
CREATE UNIQUE INDEX "project_tech_stacks_project_id_tech_stack_id_key"
  ON "public"."project_tech_stacks"("project_id", "tech_stack_id");
