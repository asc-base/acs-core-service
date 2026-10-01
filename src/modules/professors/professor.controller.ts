import Elysia from "elysia";
import { ProfessorService } from "./professor.service";
import { ProfessorRepository } from "../../infrastructure/profressor.repository";
import { ProfessorFactory } from "./profressor.factory";
import { prisma } from "../../lib/db";
import { ProfessorDocs } from "./professor.docs";
import { success } from "../../core/interceptor/response";
import { HttpStatusCode } from "../../core/types/http";
import { createProfileImageStorage } from "../../infrastructure/profile-image-storage";
import { PrismaUnitOfWorkRepository } from "../../infrastructure/prisma-uow.repository";
import { UserRepository } from "../../infrastructure/user.repository";
import { UserFactory } from "../users/user.factory";
import { authMiddleware } from "../../middleware/auth";
import { roleMacro } from "../../middleware/checkRole";
import { PERMISSION } from "../../core/permission/permission";

const userFactory = new UserFactory();
const storage = createProfileImageStorage();
const unitOfWork = new PrismaUnitOfWorkRepository(prisma);
const userRepository = new UserRepository(prisma);
const professorRepository = new ProfessorRepository(prisma);
const professorFactory = new ProfessorFactory(userFactory);
const professorService = new ProfessorService(
  professorRepository,
  userRepository,
  professorFactory,
  storage,
  unitOfWork,
);

export const ProfessorController = (app: Elysia) =>
  app.group("/professors", (app) =>
    app
      .decorate("professorService", professorService)
      .get(
        "",
        async ({ professorService, query, set }) => {
          const professors = await professorService.getProfessors(query);
          if (!professors) {
            set.status = HttpStatusCode.INTERNAL_SERVER_ERROR;
            return success(
              null,
              "Failed to retrieve professors",
              HttpStatusCode.INTERNAL_SERVER_ERROR,
            );
          }
          set.status = HttpStatusCode.OK;
          return success(
            professors,
            "Professors retrieved successfully",
            HttpStatusCode.OK,
          );
        },
        {
          ...ProfessorDocs.getProfessors,
        },
      )
      .get(
        "/:id",
        async ({ professorService, params, set }) => {
          const professor = await professorService.getProfessorById(
            Number(params.id),
          );
          if (!professor) {
            set.status = HttpStatusCode.NOT_FOUND;
            return success(
              null,
              "Professor not found",
              HttpStatusCode.NOT_FOUND,
            );
          }
          set.status = HttpStatusCode.OK;
          return success(
            professor,
            "Professor retrieved successfully",
            HttpStatusCode.OK,
          );
        },
        {
          ...ProfessorDocs.getProfessorById,
        },
      )
      .guard({}, (privateApp) =>
        privateApp
          .use(authMiddleware)
          .use(roleMacro)
          .post(
            "",
            async ({ professorService, body, set }) => {
              const professor = await professorService.createProfessor(
                body,
              );
              if (!professor) {
                set.status = HttpStatusCode.INTERNAL_SERVER_ERROR;
                return success(
                  null,
                  "Failed to create professor",
                  HttpStatusCode.INTERNAL_SERVER_ERROR,
                );
              }
              set.status = HttpStatusCode.CREATED;
              return success(
                professor,
                "Professor created successfully",
                HttpStatusCode.CREATED,
              );
            },
            {
              ...ProfessorDocs.createProfessor,
              checkRole: PERMISSION.ADMINPERSMISSION,
            },
          )
          .patch(
            "/:id",
            async ({ professorService, params, body, set }) => {
              const professor = await professorService.updateProfessor(
                Number(params.id),
                body,
              );
              if (!professor) {
                set.status = HttpStatusCode.NOT_FOUND;
                return success(
                  null,
                  "Professor not found",
                  HttpStatusCode.NOT_FOUND,
                );
              }
              set.status = HttpStatusCode.OK;
              return success(
                professor,
                "Professor updated successfully",
                HttpStatusCode.OK,
              );
            },
            {
              ...ProfessorDocs.updateProfessor,
              checkRole: PERMISSION.ADMINPERSMISSION,
            },
          )
          .delete(
            "/:id",
            async ({ professorService, params, set }) => {
              const professor = await professorService.deleteProfessor(
                Number(params.id),
              );
              set.status = HttpStatusCode.OK;
              return success(
                professor,
                "Professor deleted successfully",
                HttpStatusCode.OK,
              );
            },
            {
              ...ProfessorDocs.deleteProfessor,
              checkRole: PERMISSION.ADMINPERSMISSION,
            },
          ),
      ),
  );
