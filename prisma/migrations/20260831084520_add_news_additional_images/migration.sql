-- CreateTable
CREATE TABLE "news_additional_images" (
    "id" SERIAL NOT NULL,
    "news_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "news_additional_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "news_additional_images" ADD CONSTRAINT "news_additional_images_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "news"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
