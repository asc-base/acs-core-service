import { t } from "elysia";
import { Pageable } from "../../core/models";
import { mapResponse } from "../../core/interceptor/response";
import {
  ProjectDTO,
  CreateProjectMultipartBody,
  ProjectMultipartBody,
  ProjectQueryParams,
} from "./domain/project";

export const ProjectDocs = {
  createProject: {
    detail: {
      summary: "Create project",
      description: "Create a project with a JSON payload, thumbnail, and ordered gallery assets",
      tags: ["Projects"],
    },
    body: CreateProjectMultipartBody,
    response: { 201: mapResponse(ProjectDTO) },
  },
  getProject: {
    detail: { summary: "List projects", tags: ["Projects"] },
    query: ProjectQueryParams,
    response: { 200: mapResponse(Pageable(ProjectDTO)) },
  },
  getProjectById: {
    detail: { summary: "Get project", tags: ["Projects"] },
    params: t.Object({ id: t.Numeric() }),
    response: { 200: mapResponse(ProjectDTO), 404: mapResponse(t.Null()) },
  },
  updateProject: {
    detail: {
      summary: "Update project",
      description: "Update a project with a JSON payload and optional uploaded media",
      tags: ["Projects"],
    },
    params: t.Object({ id: t.Numeric() }),
    body: ProjectMultipartBody,
    response: { 200: mapResponse(ProjectDTO), 404: mapResponse(t.Null()) },
  },
  deleteProject: {
    detail: { summary: "Delete project", tags: ["Projects"] },
    params: t.Object({ id: t.Numeric() }),
    response: { 200: mapResponse(ProjectDTO), 404: mapResponse(t.Null()) },
  },
};
