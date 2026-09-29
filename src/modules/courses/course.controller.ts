import Elysia from "elysia";
import { CourseRepository } from "../../infrastructure/course.repository";
import { prisma } from "../../lib/db";
import { CourseService } from "./course.service";
import { success } from "../../core/interceptor/response";
import { HttpStatusCode } from "../../core/types/http";
import { CourseDocs } from "./course.docs";
import { CourseFactory } from "./course.factory";
import { authMiddleware } from "../../middleware/auth";
import { roleMacro } from "../../middleware/checkRole";
import { PERMISSION } from "../../core/permission/permission";

const courseRepository = new CourseRepository(prisma);
const courseFactory = new CourseFactory();
const courseService = new CourseService(courseRepository, courseFactory);

export const CourseController = (app: Elysia) =>
  app.group("/courses", (app) =>
    app
      .decorate("courseService", courseService)
      .get(
        "",
        async ({ courseService, query, set }) => {
          const courses = await courseService.getCourses(query);
          if (!courses) {
            return success([], "No courses found", HttpStatusCode.OK);
          }
          set.status = HttpStatusCode.OK;
          return success(
            courses,
            "Courses retrieved successfully",
            HttpStatusCode.OK,
          );
        },
        CourseDocs.getCourses,
      )
      .get(
        "/:id",
        async ({ courseService, params, set }) => {
          const course = await courseService.getCourseByID(Number(params.id));
          if (!course) {
            set.status = HttpStatusCode.NOT_FOUND;
            return success(null, "Course not found", HttpStatusCode.NOT_FOUND);
          }
          return success(course, "Course retrieved successfully");
        },
        CourseDocs.getCourseById,
      )
      .guard({}, (privateApp) =>
        privateApp
          .use(authMiddleware)
          .use(roleMacro)
          .post(
            "/batch",
            async ({ courseService, body, set }) => {
              await courseService.importCoursesFromFile(body.file as File);
              set.status = HttpStatusCode.OK;
              return success(
                null,
                "Courses imported successfully",
                HttpStatusCode.OK,
              );
            },
            {
              ...CourseDocs.batchCreateCourses,
              checkRole: PERMISSION.ADMINPERSMISSION,
            },
          )
          .post(
            "",
            async ({ courseService, body, set }) => {
              const course = await courseService.createCourse(body);
              set.status = HttpStatusCode.CREATED;
              return success(
                course,
                "Course created successfully",
                HttpStatusCode.CREATED,
              );
            },
            CourseDocs.creteCourse,
          )
          .patch(
            "/:id",
            async ({ courseService, params, body, set }) => {
              const course = await courseService.updateCourse(
                Number(params.id),
                body,
              );
              if (!course) {
                set.status = HttpStatusCode.NOT_FOUND;
                return success(
                  null,
                  "Course not found",
                  HttpStatusCode.NOT_FOUND,
                );
              }
              return success(
                course,
                "Course update successfully",
                HttpStatusCode.OK,
              );
            },
            {
              ...CourseDocs.updateCourse,
              checkRole: PERMISSION.ADMINPERSMISSION,
            },
          )
          .delete(
            "/:id",
            async ({ courseService, params, set }) => {
              const course = await courseService.deleteCourse(Number(params.id));
              if (!course) {
                set.status = HttpStatusCode.NOT_FOUND;
                return success(
                  null,
                  "Course not found",
                  HttpStatusCode.NOT_FOUND,
                );
              }
              return success(
                course,
                "Delete course successfully",
                HttpStatusCode.OK,
              );
            },
            {
              ...CourseDocs.DeleteCourse,
              checkRole: PERMISSION.ADMINPERSMISSION,
            },
          ),
      ),
  );
