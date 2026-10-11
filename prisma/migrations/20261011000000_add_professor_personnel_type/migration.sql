BEGIN;

CREATE TYPE public.professor_personnel_type AS ENUM (
  'CURRICULUM_HEAD', 'LECTURER', 'CURRICULUM_STAFF'
);

ALTER TABLE public.professors
  ADD COLUMN personnel_type public.professor_personnel_type;

COMMIT;
