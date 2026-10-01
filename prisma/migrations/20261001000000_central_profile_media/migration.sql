CREATE TABLE "public"."image_media" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "bucket" TEXT,
    "file_key" TEXT,
    "image_url" TEXT NOT NULL,
    "file_name" TEXT,
    "content_type" TEXT,
    "file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "image_media_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "image_media_image_url_key" ON "public"."image_media"("image_url");
CREATE UNIQUE INDEX "image_media_provider_bucket_file_key_key"
    ON "public"."image_media"("provider", "bucket", "file_key");

ALTER TABLE "public"."users" ADD COLUMN "image_id" INTEGER;
CREATE INDEX "users_image_id_idx" ON "public"."users"("image_id");
ALTER TABLE "public"."users"
    ADD CONSTRAINT "users_image_id_fkey"
    FOREIGN KEY ("image_id") REFERENCES "public"."image_media"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
