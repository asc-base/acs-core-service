/*
  Warnings:

  - Made the column `presentation_url` on table `projects` required. This step will fail if there are existing NULL values in that column.
  - Made the column `document_url` on table `projects` required. This step will fail if there are existing NULL values in that column.
  - Made the column `youtube_url` on table `projects` required. This step will fail if there are existing NULL values in that column.
  - Made the column `github_url` on table `projects` required. This step will fail if there are existing NULL values in that column.
  - Made the column `assets_url` on table `projects` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tech_stacks` on table `projects` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "news_features" ADD COLUMN     "highlight_url" TEXT;

-- AlterTable
ALTER TABLE "projects" ALTER COLUMN "presentation_url" SET NOT NULL,
ALTER COLUMN "document_url" SET NOT NULL,
ALTER COLUMN "youtube_url" SET NOT NULL,
ALTER COLUMN "github_url" SET NOT NULL,
ALTER COLUMN "assets_url" SET NOT NULL,
ALTER COLUMN "tech_stacks" SET NOT NULL;
