import { CurriculumService } from "./curriculum.service";
import { CurriculumRepository } from "../../infrastructure/curriculum.repository";
import { prisma } from "../../lib/db";
import { CurriculumFactory } from "./curriculum.factory";
import { SupabaseService } from "../../core/utils/supabase";
import { Elysia } from "elysia";
import { HttpStatusCode } from "../../core/types/http";
import { CurriculumDocs } from "./curriculum.docs";
import { success } from "../../core/interceptor/response";
import { authMiddleware } from "../../middleware/auth";
import { roleMacro } from "../../middleware/checkRole";
import { PERMISSION } from "../../core/permission/permission";

const curriculumRepository = new CurriculumRepository(prisma);
const curriculumFactory = new CurriculumFactory();
const supabaseService = new SupabaseService();
const curriculumService = new CurriculumService(
  curriculumRepository,
  curriculumFactory,
  supabaseService,
);

export const CurriculumController = (app: Elysia) =>
  app.decorate("curriculumService", curriculumService).group("/curriculums", (app) =>
    app
      .guard({}, (privateApp) =>
        privateApp
          .use(authMiddleware)
          .use(roleMacro)
          .post(
            "",
            async ({ curriculumService, body, set }) => {
              const curriculum = await curriculumService.createCurriculum(body);
              set.status = HttpStatusCode.CREATED;
              return success(
                curriculum,
                "Curriculum created successfully",
                HttpStatusCode.CREATED,
              );
            },
            {
              ...CurriculumDocs.createCurruculum,
              checkRole: PERMISSION.ADMINPERSMISSION,
            }
          )
          .patch(
            "/:id",
            async ({ curriculumService, params: { id }, body, set }) => {
              const curriculum = await curriculumService.updateCurriculum(id, body);
              
              set.status = HttpStatusCode.OK;
              return success(
                curriculum,
                "Curriculum updated successfully",
              );
            },
            {
              ...CurriculumDocs.updateCurriculum,
              checkRole: PERMISSION.ADMINPERSMISSION,
            }
          )
          .delete(
            "/:id",
            async ({ curriculumService, params: { id }, set }) => {
              const curriculum = await curriculumService.deleteCurriculum(id);
              
              set.status = HttpStatusCode.OK;
              return success(
                curriculum,
                "Curriculum deleted successfully",
              );
            },
            {
              ...CurriculumDocs.deleteCurriculum,
              checkRole: PERMISSION.ADMINPERSMISSION,
            }
          )
      )
      .get(
        "",
        async ({ curriculumService, query, set }) => {
          const curriculums = await curriculumService.getCurriculums(query);
          set.status = HttpStatusCode.OK;
          return success(
            curriculums ?? [],
            "Curriculums retrieved successfully",
          );
        },
        CurriculumDocs.getCurriculums,
      )
      .get(
        "/:id",
        async ({ curriculumService, params: { id }, set }) => {
          const curriculum = await curriculumService.getCurriculumById(id);
          
          set.status = HttpStatusCode.OK;
          return success(
            curriculum,
            "Curriculum retrieved successfully",
          );
        },
        CurriculumDocs.getCurriculumById,
      )
  );
