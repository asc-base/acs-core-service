-- =========================================
-- 0.delete creaeteby and updateBy
-- =========================================

ALTER TABLE "news_additional_images"
DROP COLUMN "created_by",
DROP COLUMN "updated_by";


-- =========================================
-- 1. image -> thumbnail
-- =========================================

ALTER TABLE "news"
DROP COLUMN "thumbnail";

ALTER TABLE "news"
RENAME COLUMN "image" TO "thumbnail";


-- =========================================
-- 2. highlight -> newsAdditionalImages
-- =========================================

INSERT INTO "news_additional_images" (
  "news_id",
  "image_url",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "highlight",
  now(),
  now()
FROM "news"
WHERE "highlight" IS NOT NULL;


-- =========================================
-- 3. ลบ column เก่า
-- =========================================

ALTER TABLE "news"
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
