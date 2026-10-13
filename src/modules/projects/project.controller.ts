import Elysia, { type Static, type TSchema } from "elysia";
import { Value } from "@sinclair/typebox/value";
import { ProjectRepository } from "../../infrastructure/project.repository";
import { ProjectService } from "./project.service";
import { prisma } from "../../lib/db";
import { createCentralImageStorage } from "../../infrastructure/profile-image-storage";
import { ProjectFactory } from "./project.factory";
import { ProjectDocs } from "./project.docs";
import { success } from "../../core/interceptor/response";
import { HttpStatusCode } from "../../core/types/http";
import { UserFactory } from "../users/user.factory";
import { CourseFactory } from "../courses/course.factory";
import { roleMacro } from "../../middleware/checkRole";
import { authMiddleware } from "../../middleware/auth";
import { PERMISSION } from "../../core/permission/permission";
import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";
import { CreateProjectDTO, UpdateProjectDTO } from "./domain/project";

const projectRepository = new ProjectRepository(prisma);
const imageStorage = createCentralImageStorage();
const projectFactory = new ProjectFactory(new UserFactory(), new CourseFactory());
const projectService = new ProjectService(projectRepository, imageStorage, projectFactory);

function readPayload<Schema extends TSchema>(schema: Schema, raw: string): Static<Schema> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Project payload must be valid JSON", 400);
  }
  if (!Value.Check(schema, value)) {
    const error = Value.Errors(schema, value).First();
    throw new AppError(ErrorCode.VALIDATION_ERROR, error?.message ?? "Invalid project payload", 400);
  }
  return value;
}

export const ProjectController = (app: Elysia) =>
  app.decorate("projectService", projectService).group("/project", (app) =>
    app
      .guard({}, (admin) => admin
        .use(authMiddleware)
        .use(roleMacro)
        .post("", async ({ body, projectService, set }) => {
          const payload = readPayload(CreateProjectDTO, body.payload);
          const project = await projectService.createProject(payload, {
            thumbnailFile: body.thumbnailFile,
            assets: body.assets,
          });
          set.status = HttpStatusCode.CREATED;
          return success(project);
        }, {
          ...ProjectDocs.createProject,
          checkRole: PERMISSION.ADMINPERSMISSION,
        })
        .put("/:id", async ({ body, params, projectService, set }) => {
          const payload = readPayload(UpdateProjectDTO, body.payload);
          const project = await projectService.updateProject(params.id, payload, {
            thumbnailFile: body.thumbnailFile,
            assets: body.assets,
          });
          set.status = HttpStatusCode.OK;
          return success(project, "Project updated successfully");
        }, {
          ...ProjectDocs.updateProject,
          checkRole: PERMISSION.ADMINPERSMISSION,
        })
        .delete("/:id", async ({ params, projectService, set }) => {
          const project = await projectService.deleteProject(params.id);
          set.status = HttpStatusCode.OK;
          return success(project, "Project deleted successfully");
        }, {
          ...ProjectDocs.deleteProject,
          checkRole: PERMISSION.ADMINPERSMISSION,
        }))
      .get("", async ({ projectService, query, set }) => {
        const projects = await projectService.getProject(query);
        set.status = HttpStatusCode.OK;
        return success(projects, "Project retrieved successfully");
      }, {
        ...ProjectDocs.getProject,
        beforeHandle({ request, set }) {
          const params = new URL(request.url).searchParams;
          if (["tagID", "tagId", "fields", "categories", "types"].some((key) => params.has(key))) {
            set.status = HttpStatusCode.BAD_REQUEST;
            return success(null, "Legacy project filters are no longer supported", HttpStatusCode.BAD_REQUEST);
          }
        },
      })
      .get("/:id", async ({ projectService, params, set }) => {
        const project = await projectService.getProjectById(params.id);
        if (!project) {
          set.status = HttpStatusCode.NOT_FOUND;
          return success(null, "Project not found", HttpStatusCode.NOT_FOUND);
        }
        return success(project, "Project retrieved successfully");
      }, ProjectDocs.getProjectById));
