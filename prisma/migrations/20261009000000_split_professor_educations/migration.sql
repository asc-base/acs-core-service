BEGIN;

CREATE TEMP TABLE professor_education_backfill ON COMMIT DROP AS
SELECT
  professor_id,
  (row_number() OVER (PARTITION BY professor_id ORDER BY item_ordinality) - 1)::integer AS sequence,
  education
FROM (
  SELECT p.id AS professor_id, trimmed.education, item.ordinality AS item_ordinality
  FROM public.professors AS p
  CROSS JOIN LATERAL unnest(string_to_array(p.educations, '/')) WITH ORDINALITY AS item(value, ordinality)
  CROSS JOIN LATERAL (
    SELECT btrim(
      item.value,
      U&'\0020\0009\000A\000B\000C\000D\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
    ) AS education
  ) AS trimmed
  WHERE trimmed.education <> ''
) AS entries;

CREATE TABLE public.education (
  id SERIAL PRIMARY KEY,
  education TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  professor_id INTEGER NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL,
  CONSTRAINT education_professor_id_fkey FOREIGN KEY (professor_id)
    REFERENCES public.professors(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT education_professor_id_sequence_key UNIQUE (professor_id, sequence)
);

INSERT INTO public.education (education, sequence, professor_id, updated_at)
SELECT education, sequence, professor_id, CURRENT_TIMESTAMP
FROM professor_education_backfill;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT professor_id, sequence, education FROM professor_education_backfill
    EXCEPT ALL
    SELECT professor_id, sequence, education FROM public.education
  ) OR EXISTS (
    SELECT professor_id, sequence, education FROM public.education
    EXCEPT ALL
    SELECT professor_id, sequence, education FROM professor_education_backfill
  ) THEN
    RAISE EXCEPTION 'Professor education backfill verification failed';
  END IF;
END
$migration$;

ALTER TABLE public.professors DROP COLUMN educations;

COMMIT;
