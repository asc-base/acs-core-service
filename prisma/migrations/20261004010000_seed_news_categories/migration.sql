DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."tags" AS tag
    JOIN "public"."tag_groups" AS tag_group ON tag_group."id" = tag."tage_groups_id"
    LEFT JOIN "public"."news_categories" AS by_id ON by_id."id" = tag."id"
    LEFT JOIN "public"."news_categories" AS by_code ON by_code."code" = CASE tag."name"
      WHEN 'ข่าวประชาสัมพันธ์' THEN 'ANNOUNCEMENT'
      WHEN 'ความสำเร็จนักศึกษา' THEN 'STUDENT_ACHIEVEMENT'
      WHEN 'งานกิจกรรมนักศึกษา' THEN 'STUDENT_ACTIVITY'
      ELSE 'LEGACY_TAG_' || tag."id"::TEXT
    END
    WHERE tag_group."name" = 'news'
      AND (
        (by_id."id" IS NOT NULL AND (
          by_id."code" <> CASE tag."name"
            WHEN 'ข่าวประชาสัมพันธ์' THEN 'ANNOUNCEMENT'
            WHEN 'ความสำเร็จนักศึกษา' THEN 'STUDENT_ACHIEVEMENT'
            WHEN 'งานกิจกรรมนักศึกษา' THEN 'STUDENT_ACTIVITY'
            ELSE 'LEGACY_TAG_' || tag."id"::TEXT
          END
          OR by_id."name" <> tag."name"
        ))
        OR (by_code."id" IS NOT NULL AND by_code."id" <> tag."id")
      )
  ) THEN
    RAISE EXCEPTION 'News category rows conflict with legacy news tags; resolve the existing category id/code/name mapping before migrating';
  END IF;
END $$;

INSERT INTO "public"."news_categories" ("id", "code", "name")
SELECT
  tag."id",
  CASE tag."name"
    WHEN 'ข่าวประชาสัมพันธ์' THEN 'ANNOUNCEMENT'
    WHEN 'ความสำเร็จนักศึกษา' THEN 'STUDENT_ACHIEVEMENT'
    WHEN 'งานกิจกรรมนักศึกษา' THEN 'STUDENT_ACTIVITY'
    ELSE 'LEGACY_TAG_' || tag."id"::TEXT
  END,
  tag."name"
FROM "public"."tags" AS tag
JOIN "public"."tag_groups" AS tag_group ON tag_group."id" = tag."tage_groups_id"
WHERE tag_group."name" = 'news'
ON CONFLICT DO NOTHING;

SELECT setval(
  pg_get_serial_sequence('public.news_categories', 'id'),
  GREATEST(COALESCE(MAX("id"), 1), 1),
  COUNT(*) > 0
)
FROM "public"."news_categories";
