CREATE OR REPLACE VIEW public.user_student_view AS
SELECT
  u.id,
  u.email,
  u.prefix_id,
  u.first_name_en,
  u.first_name_th,
  u.image_url,
  u.image_id,
  u.image_focal_point_x,
  u.image_focal_point_y,
  u.last_name_en,
  u.last_name_th,
  u.nick_name,
  u.created_at,
  u.updated_at,
  s.id AS student_id,
  concat_ws(
    ' ', nullif(btrim(u.first_name_th), ''), nullif(btrim(u.last_name_th), '')
  ) COLLATE "th-x-icu" AS display_name_th,
  nullif(concat_ws(
    ' ', nullif(btrim(u.first_name_en), ''), nullif(btrim(u.last_name_en), '')
  ), '') AS display_name_en
FROM public.users AS u
JOIN public.students AS s ON s.user_id = u.id
WHERE u.deleted_at IS NULL AND s.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.user_professor_view AS
SELECT
  u.id,
  u.email,
  u.prefix_id,
  u.first_name_en,
  u.first_name_th,
  u.image_url,
  u.image_id,
  u.image_focal_point_x,
  u.image_focal_point_y,
  u.last_name_en,
  u.last_name_th,
  u.nick_name,
  u.created_at,
  u.updated_at,
  p.id AS professor_id,
  concat_ws(
    ' ', nullif(btrim(u.first_name_th), ''), nullif(btrim(u.last_name_th), '')
  ) COLLATE "th-x-icu" AS display_name_th,
  nullif(concat_ws(
    ' ', nullif(btrim(u.first_name_en), ''), nullif(btrim(u.last_name_en), '')
  ), '') AS display_name_en,
  coalesce(p.personnel_type = 'CURRICULUM_HEAD', false) AS is_curriculum_head
FROM public.users AS u
JOIN public.professors AS p ON p.user_id = u.id
WHERE u.deleted_at IS NULL AND p.deleted_at IS NULL;
