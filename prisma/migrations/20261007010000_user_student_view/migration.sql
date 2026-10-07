CREATE VIEW public.user_student_view AS
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
  s.id AS student_id
FROM public.users AS u
JOIN public.students AS s ON s.user_id = u.id
WHERE u.deleted_at IS NULL AND s.deleted_at IS NULL;
