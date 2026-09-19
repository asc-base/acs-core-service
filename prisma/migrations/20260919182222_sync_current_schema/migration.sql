/*
  Warnings:

  - You are about to drop the column `highlight_focal_point_x` on the `news_features` table. All the data in the column will be lost.
  - You are about to drop the column `highlight_focal_point_y` on the `news_features` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail_focal_point_x` on the `news_features` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail_focal_point_y` on the `news_features` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "news" ALTER COLUMN "thumbnail" DROP NOT NULL;

-- AlterTable
ALTER TABLE "news_features" DROP COLUMN "highlight_focal_point_x",
DROP COLUMN "highlight_focal_point_y",
DROP COLUMN "thumbnail_focal_point_x",
DROP COLUMN "thumbnail_focal_point_y";
