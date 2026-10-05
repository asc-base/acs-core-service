-- A course code may be reused after soft deletion, but must be unique within
-- its curriculum while the course remains active.
CREATE UNIQUE INDEX "courses_curriculum_id_course_code_active_key"
ON "courses"("curriculum_id", "course_code")
WHERE "deleted_at" IS NULL;
