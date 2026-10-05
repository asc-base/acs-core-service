/*
  Warnings:

  - You are about to drop the column `highlight_url` on the `news_features` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "news_features" DROP COLUMN "highlight_url",
ADD COLUMN     "thumbnail_focal_point_x" DOUBLE PRECISION,
ADD COLUMN     "thumbnail_focal_point_y" DOUBLE PRECISION;
