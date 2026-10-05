import { Elysia } from "elysia";
import { prisma } from "../../lib/db";
import { ClassBookRepository } from "../../infrastructure/class-book.repository";
import { ClassBookService } from "./class-book.service";
import { ClassBookFactory } from "./class-book.factory";
import { createCentralImageStorage } from "../../infrastructure/profile-image-storage";
import { success } from "../../core/interceptor/response";
import { HttpStatusCode } from "../../core/types/http";
import { ClassBookDocs } from "./class-book.docs";
import { CurriculumFactory } from "../curriculums/curriculum.factory";
import { authMiddleware } from "../../middleware/auth";
import { roleMacro } from "../../middleware/checkRole";
import { PERMISSION } from "../../core/permission/permission";

const curriculumFactory = new CurriculumFactory();
const imageStorage = createCentralImageStorage();
const classBookRepository = new ClassBookRepository(prisma);
const classBookFactory = new ClassBookFactory(curriculumFactory);
const classBookService = new ClassBookService(
  classBookRepository,
  classBookFactory,
  imageStorage,
);



export const ClassBookController = (app: Elysia) =>
  app.decorate("classBookService", classBookService).group("/class-books", (app) =>
    app
      .guard({}, (privateApp) =>
        privateApp
          .use(authMiddleware)
          .use(roleMacro)
          .post(
            "",
            async ({ classBookService, body, set }) => {
              const classBook = await classBookService.createClassBook(body);
              set.status = HttpStatusCode.CREATED;
              return success(
                classBook,
                "Class book created successfully",
                HttpStatusCode.CREATED,
              );
            },
            {
              ...ClassBookDocs.createClassBook,
              checkRole: PERMISSION.ADMINPERSMISSION,
            }
          )
          .patch(
            "/:id",
            async ({ classBookService, params, body }) => {
              const classBook = await classBookService.updateClassBook(
                Number(params.id),
                body,
              );
              return success(
                classBook,
                "ClassBook update successfully",
                HttpStatusCode.OK,);
            },
            {
              ...ClassBookDocs.updateClassBook,
              checkRole: PERMISSION.ADMINPERSMISSION,
            },
          )
          .delete(
            "/:id",
            async ({ classBookService, params }) => {
              const classBook = await classBookService.deleteClassBook(
                Number(params.id),
              );
              return success(classBook, "Class Book deleted successfully");
            },
            {
              ...ClassBookDocs.deleteClassBook,
              checkRole: PERMISSION.ADMINPERSMISSION,
            },
          )
      )
      .get(
        "",
        async ({ classBookService, query, set }) => {
          const classBooks = await classBookService.getClassBooks(query);
          set.status = HttpStatusCode.OK;
          return success(classBooks, "Class books retrieved successfully");
        },
        ClassBookDocs.getClassBooks,
      )
      .get(
        "/:id",
        async ({ classBookService, params, set }) => {
          try {
            const classBook = await classBookService.getClassBookById(
              params.id,
            );
            if (!classBook) {
              set.status = HttpStatusCode.NOT_FOUND;
              return success(
                null,
                "Class book not found",
                HttpStatusCode.NOT_FOUND,
              );
            }
            return success(classBook, "Class book retrieved successfully");
          } catch (error) {
            console.log(error);
          }
        },
        ClassBookDocs.getClassBookById,
      ),
  );
