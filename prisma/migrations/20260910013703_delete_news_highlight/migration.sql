-- =========================================
-- 1. image -> thumbnail
-- =========================================

UPDATE "news"
SET "thumbnail" = "image"
WHERE "image" IS NOT NULL
  AND ("thumbnail" IS NULL OR "thumbnail" = '');


-- =========================================
-- 2. highlight -> newsAdditionalImages
-- =========================================

INSERT INTO "news_additional_images" (
  "news_id",
  "image_url"
)
SELECT
  "id",
  "highlight"
FROM "news"
WHERE "highlight" IS NOT NULL
  AND "highlight" <> '';


-- =========================================
-- 3. ลบ column เก่า
-- =========================================

ALTER TABLE "news"
DROP COLUMN "image",
DROP COLUMN "highlight",
DROP COLUMN "card_focal_point_x",
DROP COLUMN "card_focal_point_y";


-- =========================================
-- 4. rename constraint/index
-- =========================================

ALTER TABLE "prefixes"
RENAME CONSTRAINT "academic_positions_pkey"
TO "prefixes_pkey";

ALTER INDEX "academic_positions_name_th_key"
RENAME TO "prefixes_name_th_key";

ALTER INDEX "academic_positions_sequence_key"
RENAME TO "prefixes_sequence_key";