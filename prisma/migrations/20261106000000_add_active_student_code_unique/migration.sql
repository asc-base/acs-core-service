CREATE UNIQUE INDEX "students_student_code_active_key"
ON "students"("student_code")
WHERE "deleted_at" IS NULL;
