CREATE TYPE "public"."news_image_type" AS ENUM ('CARD', 'THUMBNAIL', 'DETAIL');
CREATE TYPE "public"."news_bulletin_type" AS ENUM ('HIGHLIGHT', 'ANNOUNCEMENT');

CREATE TABLE "public"."news_categories" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "news_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "news_categories_code_key" ON "public"."news_categories"("code");

ALTER TABLE "public"."news"
  ADD COLUMN "news_category_id" INTEGER,
  ADD COLUMN "event_start_at" TIMESTAMP(3),
  ADD COLUMN "event_end_at" TIMESTAMP(3);

CREATE INDEX "news_news_category_id_idx" ON "public"."news"("news_category_id");
CREATE INDEX "news_event_start_at_idx" ON "public"."news"("event_start_at");
ALTER TABLE "public"."news" ADD CONSTRAINT "news_news_category_id_fkey"
  FOREIGN KEY ("news_category_id") REFERENCES "public"."news_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "public"."news_images" (
    "id" SERIAL NOT NULL,
    "news_id" INTEGER NOT NULL,
    "image_id" INTEGER NOT NULL,
    "image_type" "public"."news_image_type" NOT NULL,
    "focal_point_x" DOUBLE PRECISION,
    "focal_point_y" DOUBLE PRECISION,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "news_images_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."news_images"
  ADD CONSTRAINT "news_images_focal_point_x_range" CHECK ("focal_point_x" IS NULL OR "focal_point_x" BETWEEN 0 AND 100),
  ADD CONSTRAINT "news_images_focal_point_y_range" CHECK ("focal_point_y" IS NULL OR "focal_point_y" BETWEEN 0 AND 100);
CREATE INDEX "news_images_news_id_idx" ON "public"."news_images"("news_id");
CREATE INDEX "news_images_image_id_idx" ON "public"."news_images"("image_id");
CREATE UNIQUE INDEX "news_images_news_id_image_id_image_type_key"
  ON "public"."news_images"("news_id", "image_id", "image_type");
CREATE UNIQUE INDEX "news_images_one_active_cover_per_type"
  ON "public"."news_images"("news_id", "image_type")
  WHERE "deleted_at" IS NULL AND "image_type" IN ('CARD', 'THUMBNAIL');
ALTER TABLE "public"."news_images" ADD CONSTRAINT "news_images_news_id_fkey"
  FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."news_images" ADD CONSTRAINT "news_images_image_id_fkey"
  FOREIGN KEY ("image_id") REFERENCES "public"."image_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "public"."news_bulletins" (
    "id" SERIAL NOT NULL,
    "news_id" INTEGER NOT NULL,
    "type" "public"."news_bulletin_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "news_bulletins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "news_bulletins_news_id_type_key" ON "public"."news_bulletins"("news_id", "type");
ALTER TABLE "public"."news_bulletins" ADD CONSTRAINT "news_bulletins_news_id_fkey"
  FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
