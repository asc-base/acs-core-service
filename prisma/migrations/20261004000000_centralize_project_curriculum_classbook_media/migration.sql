ALTER TABLE "public"."projects" ADD COLUMN "image_id" INTEGER;
ALTER TABLE "public"."curriculums" ADD COLUMN "image_id" INTEGER;
ALTER TABLE "public"."class_books" ADD COLUMN "image_id" INTEGER;

CREATE INDEX "projects_image_id_idx" ON "public"."projects"("image_id");
CREATE INDEX "curriculums_image_id_idx" ON "public"."curriculums"("image_id");
CREATE INDEX "class_books_image_id_idx" ON "public"."class_books"("image_id");

ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_image_id_fkey"
  FOREIGN KEY ("image_id") REFERENCES "public"."image_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."curriculums" ADD CONSTRAINT "curriculums_image_id_fkey"
  FOREIGN KEY ("image_id") REFERENCES "public"."image_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."class_books" ADD CONSTRAINT "class_books_image_id_fkey"
  FOREIGN KEY ("image_id") REFERENCES "public"."image_media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "public"."project_images" (
  "id" SERIAL NOT NULL,
  "project_id" INTEGER NOT NULL,
  "image_id" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "project_images_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_images_project_id_sort_order_key"
  ON "public"."project_images"("project_id", "sort_order");
CREATE INDEX "project_images_image_id_idx" ON "public"."project_images"("image_id");
ALTER TABLE "public"."project_images" ADD CONSTRAINT "project_images_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."project_images" ADD CONSTRAINT "project_images_image_id_fkey"
  FOREIGN KEY ("image_id") REFERENCES "public"."image_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
