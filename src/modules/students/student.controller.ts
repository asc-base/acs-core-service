import Elysia from "elysia";
import { StudentService } from "./student.service";
import { StudentRepository } from "../../infrastructure/student.repository";
import { PrismaUnitOfWorkRepository } from "../../infrastructure/prisma-uow.repository";
import { prisma } from "../../lib/db";
import { UserRepository } from "../../infrastructure/user.repository";
import { SupabaseService } from "../../core/utils/supabase";
import { StudentDocs } from "./student.docs";
import { StudentFactory } from "./student.factory";
import { success } from "../../core/interceptor/response";
import { HttpStatusCode } from "../../core/types/http";
import { UserFactory } from "../users/user.factory";
import { authMiddleware } from "../../middleware/auth";
import { roleMacro } from "../../middleware/checkRole";
import { PERMISSION } from "../../core/permission/permission";

const userFactory = new UserFactory();
const studentRepository = new StudentRepository(prisma);
const userRepository = new UserRepository(prisma);
const studentFactory = new StudentFactory(userFactory);
const supabaseService = new SupabaseService();
const studentUnitOfWork = new PrismaUnitOfWorkRepository(prisma);

const studentService = new StudentService(
  studentRepository,
  userRepository,
  supabaseService,
  studentFactory,
  studentUnitOfWork,
);

export const StudentController = (app: Elysia) =>
  app.decorate("studentService", studentService).group("students", (app) =>
    app
      .guard({}, (privateApp) =>
        privateApp
          .use(authMiddleware)
          .use(roleMacro)
          .post(
            "",
            async ({ body, studentService, set }) => {
              const student = await studentService.createStudent(body);
              set.status = HttpStatusCode.CREATED;
              return success(
                student,
                "Student created successfully",
                HttpStatusCode.CREATED,
              );
            },
            {
              ...StudentDocs.createStudent,
              checkRole: PERMISSION.ADMINPERSMISSION,
            },
          )
          .post(
            "/batch",
            async ({ body, studentService, set }) => {
              const { file, classBookID } = body;
              await studentService.importStudentsFromFile(
                file,
                classBookID,
              );
              set.status = HttpStatusCode.OK;
              return success(
                null,
                "Students imported successfully",
                HttpStatusCode.OK,
              );
            },
            {
              ...StudentDocs.createStudentBatch,
              checkRole: PERMISSION.ADMINPERSMISSION,
            },
          )
          .delete(
            "/:id",
            async ({ studentService, params }) => {
              const student = await studentService.deleteStudent(
                Number(params.id),
              );
              return success(student, "Student deleted successfully");
            },
            {
              ...StudentDocs.deleteStudent,
              checkRole: PERMISSION.ADMINPERSMISSION,
            },
          )
          .patch(
            "/:id",
            async ({ studentService, params, body }) => {
              const student = await studentService.updateStudent(
                params.id,
                body,
              );
              return success(student, "Student updated successfully");
            },
            {
              ...StudentDocs.updateStudent,
              checkRole: PERMISSION.UPDATEUSERSPERMISSION,
            },
          ),
      )
      .get(
        "",
        async ({ studentService, set, query }) => {
          const students = await studentService.getStudents(query);
          set.status = HttpStatusCode.OK;
          return success(students, "Students retrieved successfully");
        },
        StudentDocs.getStudents,
      )
      .get(
        "/:id",
        async ({ studentService, params, set }) => {
          const student = await studentService.getStudentById(
            Number(params.id),
          );
          if (!student) {
            set.status = HttpStatusCode.NOT_FOUND;
            return success(null, "Student not found", HttpStatusCode.NOT_FOUND);
          }
          return success(student, "Student retrieved successfully");
        },
        StudentDocs.getStudentById,
      )
      .get(
        "/user/:userId",
        async ({ studentService, params, set }) => {
          const student = await studentService.getStudentByUserId(
            Number(params.userId),
          );
          if (!student) {
            set.status = HttpStatusCode.NOT_FOUND;
            return success(null, "Student not found", HttpStatusCode.NOT_FOUND);
          }
          return success(student, "Student retrieved successfully");
        },
        StudentDocs.getStudentByUserId,
      ),
  );
