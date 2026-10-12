BEGIN;

DO $$
DECLARE
  problem TEXT;
  item RECORD;
  occupied_name TEXT;
  existing_id INTEGER;
  category_name_count INTEGER;
  lookup_table TEXT;
  seed_count INTEGER;
BEGIN
  SELECT string_agg(format('%s.%s -> %s', child.relname, constraint_row.conname, parent.relname), E'\n')
  INTO problem
  FROM pg_constraint AS constraint_row
  JOIN pg_class AS child ON child.oid = constraint_row.conrelid
  JOIN pg_class AS parent ON parent.oid = constraint_row.confrelid
  JOIN pg_namespace AS child_ns ON child_ns.oid = child.relnamespace
  JOIN pg_namespace AS parent_ns ON parent_ns.oid = parent.relnamespace
  WHERE constraint_row.contype = 'f'
    AND parent_ns.nspname = 'public'
    AND parent.relname IN ('tags', 'tag_groups')
    AND NOT (
      (child_ns.nspname = 'public' AND child.relname = 'tags' AND parent.relname = 'tag_groups') OR
      (child_ns.nspname = 'public' AND child.relname = 'news' AND parent.relname = 'tags') OR
      (child_ns.nspname = 'public' AND child.relname = 'news_features' AND parent.relname = 'tags') OR
      (child_ns.nspname = 'public' AND child.relname = 'project_tags' AND parent.relname = 'tags')
    );
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'Unexpected foreign keys still reference tags: %', problem;
  END IF;

  SELECT string_agg(view_ns.nspname || '.' || view_row.relname, ', ')
  INTO problem
  FROM pg_depend AS dependency
  JOIN pg_rewrite AS rewrite ON rewrite.oid = dependency.objid
  JOIN pg_class AS view_row ON view_row.oid = rewrite.ev_class
  JOIN pg_namespace AS view_ns ON view_ns.oid = view_row.relnamespace
  JOIN pg_class AS source_row ON source_row.oid = dependency.refobjid
  JOIN pg_namespace AS source_ns ON source_ns.oid = source_row.relnamespace
  WHERE source_ns.nspname = 'public'
    AND source_row.relname IN ('tags', 'tag_groups')
    AND view_row.relkind = 'v';
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'Views still depend on tags: %', problem;
  END IF;

  FOR item IN SELECT * FROM (VALUES
    (1, 'ANNOUNCEMENT', 'ข่าวประชาสัมพันธ์'),
    (2, 'STUDENT_ACHIEVEMENT', 'ความสำเร็จนักศึกษา'),
    (3, 'STUDENT_ACTIVITY', 'งานกิจกรรมนักศึกษา')
  ) AS expected(id, code, name)
  LOOP
    SELECT name INTO occupied_name FROM public.news_categories WHERE id = item.id;
    IF occupied_name IS NOT NULL AND occupied_name <> item.name THEN
      RAISE EXCEPTION 'news_categories ID % is occupied by %', item.id, occupied_name;
    END IF;
    SELECT id INTO existing_id FROM public.news_categories WHERE code = item.code;
    IF existing_id IS NOT NULL THEN
      SELECT name INTO occupied_name FROM public.news_categories WHERE id = existing_id;
      IF occupied_name <> item.name THEN
        RAISE EXCEPTION 'news category code % belongs to %', item.code, occupied_name;
      END IF;
    END IF;
    SELECT count(*) INTO category_name_count FROM public.news_categories WHERE name = item.name;
    IF category_name_count > 1 THEN
      RAISE EXCEPTION 'news category name % is ambiguous', item.name;
    END IF;
    IF category_name_count = 1 AND NOT EXISTS (
      SELECT 1 FROM public.news_categories WHERE name = item.name AND code = item.code
    ) THEN
      RAISE EXCEPTION 'news category name % belongs to another code', item.name;
    END IF;
  END LOOP;

  SELECT string_agg(format('news %s has unresolved or conflicting category %s', news.id, COALESCE(tag.name, '<missing>')), E'\n')
  INTO problem
  FROM public.news AS news
  JOIN public.tags AS tag ON tag.id = news.tag_id
  LEFT JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
  LEFT JOIN public.news_categories AS current_category ON current_category.id = news.news_category_id
  WHERE tag_group.name IS DISTINCT FROM 'news'
     OR (news.news_category_id IS NOT NULL AND current_category.name IS DISTINCT FROM tag.name)
     OR (
       NOT EXISTS (SELECT 1 FROM public.news_categories AS category WHERE category.name = tag.name)
       AND tag.name NOT IN ('ข่าวประชาสัมพันธ์', 'ความสำเร็จนักศึกษา', 'งานกิจกรรมนักศึกษา')
     )
     OR (SELECT count(*) FROM public.news_categories AS category WHERE category.name = tag.name) > 1;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'News category mapping must be resolved before tags can be retired: %', problem;
  END IF;

  SELECT string_agg(format('%s ID %s is occupied by %s', seed.group_name, seed.id, lookup.name), E'\n')
  INTO problem
  FROM (VALUES
    ('fields', 1, 'Artificial intelligence'), ('fields', 2, 'Network'), ('fields', 3, 'Cloud computing'),
    ('fields', 4, 'Security'), ('fields', 5, 'Computer Architecture'), ('fields', 6, 'Software Engineering'),
    ('fields', 7, 'Computational Theory'), ('fields', 8, 'GIS'), ('fields', 9, 'Game Design'),
    ('fields', 10, 'Data Science and analytics'), ('fields', 11, 'Data Structures and Algorithms'),
    ('categories', 1, 'Education'), ('categories', 2, 'Medical'), ('categories', 3, 'Research Category'),
    ('categories', 4, 'Business'), ('categories', 5, 'Game'), ('categories', 6, 'Agricultural'),
    ('project_types', 1, 'Research'), ('project_types', 2, 'Web Application'),
    ('project_types', 3, 'Mobile Application'), ('project_types', 4, 'Internet Of Things')
  ) AS seed(group_name, id, name)
  JOIN LATERAL (
    SELECT fields.name FROM public.fields AS fields WHERE seed.group_name = 'fields' AND fields.id = seed.id
    UNION ALL SELECT categories.name FROM public.categories AS categories WHERE seed.group_name = 'categories' AND categories.id = seed.id
    UNION ALL SELECT project_types.name FROM public.project_types AS project_types WHERE seed.group_name = 'project_types' AND project_types.id = seed.id
  ) AS lookup ON lookup.name <> seed.name;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'Project classification ID conflicts must be resolved: %', problem;
  END IF;

  SELECT string_agg(format('project %s has conflicting %s values: legacy [%s], current [%s]', legacy.project_id, legacy.group_name, legacy.names, current.names), E'\n')
  INTO problem
  FROM (
    SELECT project_tags.project_id, tag_group.name AS group_name, array_agg(DISTINCT tag.name ORDER BY tag.name) AS names
    FROM public.project_tags AS project_tags
    JOIN public.tags AS tag ON tag.id = project_tags.tag_id
    JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
    WHERE project_tags.deleted_at IS NULL AND tag_group.name IN ('field', 'category', 'type')
    GROUP BY project_tags.project_id, tag_group.name
  ) AS legacy
  JOIN LATERAL (
    SELECT 'field'::text AS group_name, array_agg(field.name ORDER BY field.name) AS names
    FROM public.project_fields AS link JOIN public.fields AS field ON field.id = link.field_id
    WHERE link.project_id = legacy.project_id AND legacy.group_name = 'field'
    HAVING count(*) > 0
    UNION ALL
    SELECT 'category', array_agg(category.name ORDER BY category.name)
    FROM public.project_categories AS link JOIN public.categories AS category ON category.id = link.category_id
    WHERE link.project_id = legacy.project_id AND legacy.group_name = 'category'
    HAVING count(*) > 0
    UNION ALL
    SELECT 'type', array_agg(project_type.name ORDER BY project_type.name)
    FROM public.project_project_types AS link JOIN public.project_types AS project_type ON project_type.id = link.type_id
    WHERE link.project_id = legacy.project_id AND legacy.group_name = 'type'
    HAVING count(*) > 0
  ) AS current ON current.group_name = legacy.group_name
  WHERE current.names IS DISTINCT FROM legacy.names;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'Project classifications differ between new and legacy data: %', problem;
  END IF;

  SELECT string_agg(format('project %s has active tag %s in unsupported group %s', link.project_id, tag.name, COALESCE(tag_group.name, '<missing>')), E'\n')
  INTO problem
  FROM public.project_tags AS link
  JOIN public.tags AS tag ON tag.id = link.tag_id
  LEFT JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
  WHERE link.deleted_at IS NULL AND tag_group.name NOT IN ('field', 'category', 'type');
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'Project tag groups without a destination must be resolved: %', problem;
  END IF;

  SELECT string_agg(format('news feature %s has unsupported tag %s/%s or an empty image URL', feature.id, COALESCE(tag_group.name, '<missing>'), COALESCE(tag.name, '<missing>')), E'\n')
  INTO problem
  FROM public.news_features AS feature
  LEFT JOIN public.tags AS tag ON tag.id = feature.tag_id
  LEFT JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
  WHERE tag_group.name IS DISTINCT FROM 'news-feature'
     OR lower(tag.name) NOT IN ('announcement', 'newshighlight')
     OR btrim(feature.thumbnail_url) = '';
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'News feature mappings must be resolved before tags can be retired: %', problem;
  END IF;

  SELECT string_agg(format('news %s has more than one feature for %s', feature.news_id, lower(tag.name)), E'\n')
  INTO problem
  FROM public.news_features AS feature
  JOIN public.tags AS tag ON tag.id = feature.tag_id
  JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
  WHERE tag_group.name = 'news-feature'
  GROUP BY feature.news_id, lower(tag.name)
  HAVING count(*) > 1;
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate news features cannot map to one bulletin: %', problem;
  END IF;

  -- Existing target rows are authoritative; disabling a bulletin does not delete its image.
  SELECT string_agg(format('news %s already has a different active image for %s', feature.news_id, lower(tag.name)), E'\n')
  INTO problem
  FROM public.news_features AS feature
  JOIN public.tags AS tag ON tag.id = feature.tag_id
  JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
  WHERE tag_group.name = 'news-feature'
    AND feature.deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.news_images AS other_link
      JOIN public.image_media AS other_media ON other_media.id = other_link.image_id
      WHERE other_link.news_id = feature.news_id
        AND other_link.image_type = CASE lower(tag.name) WHEN 'announcement' THEN 'CARD'::public.news_image_type ELSE 'THUMBNAIL'::public.news_image_type END
        AND other_link.deleted_at IS NULL
        AND other_media.image_url <> feature.thumbnail_url
    );
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'News feature mappings conflict with existing active images: %', problem;
  END IF;

  FOR item IN SELECT * FROM (VALUES
    ('fields', 1, 'Artificial intelligence'), ('fields', 2, 'Network'), ('fields', 3, 'Cloud computing'),
    ('fields', 4, 'Security'), ('fields', 5, 'Computer Architecture'), ('fields', 6, 'Software Engineering'),
    ('fields', 7, 'Computational Theory'), ('fields', 8, 'GIS'), ('fields', 9, 'Game Design'),
    ('fields', 10, 'Data Science and analytics'), ('fields', 11, 'Data Structures and Algorithms'),
    ('categories', 1, 'Education'), ('categories', 2, 'Medical'), ('categories', 3, 'Research Category'),
    ('categories', 4, 'Business'), ('categories', 5, 'Game'), ('categories', 6, 'Agricultural'),
    ('project_types', 1, 'Research'), ('project_types', 2, 'Web Application'),
    ('project_types', 3, 'Mobile Application'), ('project_types', 4, 'Internet Of Things')
  ) AS seed(table_name, id, name)
  LOOP
    EXECUTE format('SELECT name FROM public.%I WHERE id = $1', item.table_name) INTO occupied_name USING item.id;
    IF occupied_name IS NOT NULL AND occupied_name <> item.name THEN
      RAISE EXCEPTION '% ID % is occupied by %', item.table_name, item.id, occupied_name;
    END IF;
    EXECUTE format('SELECT id FROM public.%I WHERE name = $1', item.table_name) INTO existing_id USING item.name;
    IF existing_id IS NULL THEN
      EXECUTE format('INSERT INTO public.%I (id, name) VALUES ($1, $2)', item.table_name) USING item.id, item.name;
    ELSIF existing_id <> item.id THEN
      EXECUTE format('UPDATE public.%I SET id = $1 WHERE id = $2', item.table_name) USING item.id, existing_id;
    END IF;
  END LOOP;

  FOR item IN
    SELECT tag.id, tag.name, tag_group.name AS group_name
    FROM public.tags AS tag
    JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
    WHERE tag_group.name IN ('field', 'category', 'type')
      AND NOT EXISTS (
        SELECT 1 FROM public.fields AS lookup WHERE tag_group.name = 'field' AND lookup.name = tag.name
        UNION ALL SELECT 1 FROM public.categories AS lookup WHERE tag_group.name = 'category' AND lookup.name = tag.name
        UNION ALL SELECT 1 FROM public.project_types AS lookup WHERE tag_group.name = 'type' AND lookup.name = tag.name
      )
    ORDER BY tag.id
  LOOP
    lookup_table := CASE item.group_name WHEN 'field' THEN 'fields' WHEN 'category' THEN 'categories' ELSE 'project_types' END;
    seed_count := CASE item.group_name WHEN 'field' THEN 11 WHEN 'category' THEN 6 ELSE 4 END;
    EXECUTE format(
      'INSERT INTO public.%I (id, name) SELECT GREATEST(COALESCE(MAX(id), 0), $1) + 1, $2 FROM public.%I',
      lookup_table, lookup_table
    ) USING seed_count, item.name;
  END LOOP;

  FOR item IN SELECT * FROM (VALUES
    (1, 'ANNOUNCEMENT', 'ข่าวประชาสัมพันธ์'),
    (2, 'STUDENT_ACHIEVEMENT', 'ความสำเร็จนักศึกษา'),
    (3, 'STUDENT_ACTIVITY', 'งานกิจกรรมนักศึกษา')
  ) AS seed(id, code, name)
  LOOP
    SELECT id INTO existing_id FROM public.news_categories WHERE code = item.code;
    IF existing_id IS NULL THEN
      INSERT INTO public.news_categories (id, code, name) VALUES (item.id, item.code, item.name);
    ELSIF existing_id <> item.id THEN
      UPDATE public.news_categories SET id = item.id WHERE id = existing_id;
    END IF;
  END LOOP;

  UPDATE public.news AS news
  SET news_category_id = category.id
  FROM public.tags AS tag
  JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
  JOIN public.news_categories AS category ON category.name = tag.name
  WHERE news.tag_id = tag.id AND tag_group.name = 'news';

  INSERT INTO public.project_fields (project_id, field_id)
  SELECT link.project_id, field.id
  FROM public.project_tags AS link
  JOIN public.tags AS tag ON tag.id = link.tag_id
  JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id AND tag_group.name = 'field'
  JOIN public.fields AS field ON field.name = tag.name
  WHERE link.deleted_at IS NULL
  ON CONFLICT (project_id, field_id) DO NOTHING;

  INSERT INTO public.project_categories (project_id, category_id)
  SELECT link.project_id, category.id
  FROM public.project_tags AS link
  JOIN public.tags AS tag ON tag.id = link.tag_id
  JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id AND tag_group.name = 'category'
  JOIN public.categories AS category ON category.name = tag.name
  WHERE link.deleted_at IS NULL
  ON CONFLICT (project_id, category_id) DO NOTHING;

  INSERT INTO public.project_project_types (project_id, type_id)
  SELECT link.project_id, project_type.id
  FROM public.project_tags AS link
  JOIN public.tags AS tag ON tag.id = link.tag_id
  JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id AND tag_group.name = 'type'
  JOIN public.project_types AS project_type ON project_type.name = tag.name
  WHERE link.deleted_at IS NULL
  ON CONFLICT (project_id, type_id) DO NOTHING;

  INSERT INTO public.image_media (provider, image_url, created_at, updated_at)
  SELECT 'legacy_url', feature.thumbnail_url, MIN(feature.created_at), MAX(feature.updated_at)
  FROM public.news_features AS feature
  GROUP BY feature.thumbnail_url
  ON CONFLICT (image_url) DO NOTHING;

  INSERT INTO public.news_bulletins (news_id, type, created_at, updated_at, deleted_at)
  SELECT feature.news_id,
    CASE lower(tag.name) WHEN 'announcement' THEN 'ANNOUNCEMENT'::public.news_bulletin_type ELSE 'HIGHLIGHT'::public.news_bulletin_type END,
    feature.created_at, feature.updated_at, feature.deleted_at
  FROM public.news_features AS feature
  JOIN public.tags AS tag ON tag.id = feature.tag_id
  JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id AND tag_group.name = 'news-feature'
  ON CONFLICT (news_id, type) DO NOTHING;

  INSERT INTO public.news_images (news_id, image_id, image_type, focal_point_x, focal_point_y, sort_order, created_at, updated_at, deleted_at)
  SELECT feature.news_id, media.id,
    CASE lower(tag.name) WHEN 'announcement' THEN 'CARD'::public.news_image_type ELSE 'THUMBNAIL'::public.news_image_type END,
    feature.thumbnail_focal_point_x, feature.thumbnail_focal_point_y, 0, feature.created_at, feature.updated_at, feature.deleted_at
  FROM public.news_features AS feature
  JOIN public.tags AS tag ON tag.id = feature.tag_id
  JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id AND tag_group.name = 'news-feature'
  JOIN public.image_media AS media ON media.image_url = feature.thumbnail_url
  ON CONFLICT (news_id, image_id, image_type) DO NOTHING;

  IF EXISTS (
    SELECT 1
    FROM public.news AS news
    JOIN public.tags AS tag ON tag.id = news.tag_id
    JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
    LEFT JOIN public.news_categories AS category ON category.id = news.news_category_id
    WHERE tag_group.name IS DISTINCT FROM 'news' OR news.news_category_id IS NULL OR category.name IS DISTINCT FROM tag.name
  ) THEN
    RAISE EXCEPTION 'News category backfill verification failed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.project_tags AS link
    JOIN public.tags AS tag ON tag.id = link.tag_id
    JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
    LEFT JOIN public.fields AS field ON tag_group.name = 'field' AND field.name = tag.name
    LEFT JOIN public.categories AS category ON tag_group.name = 'category' AND category.name = tag.name
    LEFT JOIN public.project_types AS project_type ON tag_group.name = 'type' AND project_type.name = tag.name
    WHERE link.deleted_at IS NULL AND tag_group.name IN ('field', 'category', 'type')
      AND field.id IS NULL AND category.id IS NULL AND project_type.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Project classification backfill verification failed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.news_features AS feature
    JOIN public.tags AS tag ON tag.id = feature.tag_id
    JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id
    LEFT JOIN public.news_bulletins AS bulletin ON bulletin.news_id = feature.news_id
      AND bulletin.type = CASE lower(tag.name) WHEN 'announcement' THEN 'ANNOUNCEMENT'::public.news_bulletin_type ELSE 'HIGHLIGHT'::public.news_bulletin_type END
    LEFT JOIN public.image_media AS media ON media.image_url = feature.thumbnail_url
    LEFT JOIN public.news_images AS image_link ON image_link.news_id = feature.news_id AND image_link.image_id = media.id
      AND image_link.image_type = CASE lower(tag.name) WHEN 'announcement' THEN 'CARD'::public.news_image_type ELSE 'THUMBNAIL'::public.news_image_type END
    WHERE tag_group.name = 'news-feature' AND (bulletin.id IS NULL OR image_link.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'News bulletin/media backfill verification failed';
  END IF;

  PERFORM setval(pg_get_serial_sequence('public.news_categories', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.news_categories), 1), 1), true);
  PERFORM setval(pg_get_serial_sequence('public.fields', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.fields), 11), 11), true);
  PERFORM setval(pg_get_serial_sequence('public.categories', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.categories), 6), 6), true);
  PERFORM setval(pg_get_serial_sequence('public.project_types', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.project_types), 4), 4), true);
END $$;

DO $$
DECLARE constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.news'::regclass AND confrelid = 'public.tags'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.news DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.news DROP COLUMN tag_id;
DROP TABLE public.project_tags;
DROP TABLE public.news_features;
DROP TABLE public.tags;
DROP TABLE public.tag_groups;

COMMIT;
