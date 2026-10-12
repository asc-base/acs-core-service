BEGIN;

DO $$
DECLARE
  expected RECORD;
  code_count INTEGER;
  name_count INTEGER;
  code_id INTEGER;
  name_id INTEGER;
  target_id RECORD;
BEGIN
  FOR expected IN
    SELECT * FROM (VALUES
      (1, 'ANNOUNCEMENT', 'ข่าวประชาสัมพันธ์'),
      (2, 'STUDENT_ACHIEVEMENT', 'ความสำเร็จนักศึกษา'),
      (3, 'STUDENT_ACTIVITY', 'งานกิจกรรมนักศึกษา')
    ) AS categories(id, code, name)
  LOOP
    SELECT COUNT(*), MIN(id) INTO code_count, code_id FROM public.news_categories WHERE code = expected.code;
    SELECT COUNT(*), MIN(id) INTO name_count, name_id FROM public.news_categories WHERE name = expected.name;

    IF code_count > 1 OR name_count > 1 OR (code_count = 1 AND name_count = 1 AND code_id <> name_id) THEN
      RAISE EXCEPTION 'News category code/name conflict for %/%', expected.code, expected.name;
    END IF;
    IF code_count = 1 AND EXISTS (SELECT 1 FROM public.news_categories WHERE id = code_id AND name <> expected.name) THEN
      RAISE EXCEPTION 'News category code % belongs to a different name', expected.code;
    END IF;
    IF name_count = 1 AND EXISTS (SELECT 1 FROM public.news_categories WHERE id = name_id AND code <> expected.code AND code IN ('ANNOUNCEMENT', 'STUDENT_ACHIEVEMENT', 'STUDENT_ACTIVITY')) THEN
      RAISE EXCEPTION 'News category name % belongs to a different seeded code', expected.name;
    END IF;

    SELECT id, code, name INTO target_id FROM public.news_categories WHERE id = expected.id;
    IF FOUND AND (target_id.code <> expected.code OR target_id.name <> expected.name)
       AND COALESCE(code_id, name_id, -1) <> expected.id THEN
      RAISE EXCEPTION 'News category ID % is occupied by %/%', expected.id, target_id.code, target_id.name;
    END IF;
  END LOOP;
END $$;

UPDATE public.news_categories AS category
SET id = expected.id, code = expected.code, name = expected.name
FROM (VALUES
  (1, 'ANNOUNCEMENT', 'ข่าวประชาสัมพันธ์'),
  (2, 'STUDENT_ACHIEVEMENT', 'ความสำเร็จนักศึกษา'),
  (3, 'STUDENT_ACTIVITY', 'งานกิจกรรมนักศึกษา')
) AS expected(id, code, name)
WHERE category.code = expected.code OR category.name = expected.name;

INSERT INTO public.news_categories (id, code, name)
VALUES
  (1, 'ANNOUNCEMENT', 'ข่าวประชาสัมพันธ์'),
  (2, 'STUDENT_ACHIEVEMENT', 'ความสำเร็จนักศึกษา'),
  (3, 'STUDENT_ACTIVITY', 'งานกิจกรรมนักศึกษา')
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT tag.name
    FROM public.tags AS tag
    JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
    JOIN public.news_categories AS category ON category.name = tag.name
    WHERE tag_group.name = 'news'
    GROUP BY tag.name
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'A news tag name matches multiple news categories';
  END IF;
END $$;

UPDATE public.news AS news
SET news_category_id = category.id
FROM public.tags AS tag
JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
JOIN public.news_categories AS category ON category.name = tag.name
WHERE news.tag_id = tag.id
  AND tag_group.name = 'news';

SELECT setval(
  pg_get_serial_sequence('public.news_categories', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM public.news_categories), 1), 1)
);

COMMIT;
