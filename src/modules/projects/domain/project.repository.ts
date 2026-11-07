import type {
  Project,
  ProjectCreatePayload,
  ProjectQueryParams,
  ProjectUpdatePayload,
} from "./project";

export interface IProjectRepository {
  createProject(projectData: ProjectCreatePayload): Promise<Project>;
  getProject(query: ProjectQueryParams): Promise<Project[]>;
  getProjectById(id: number): Promise<Project | null>;
  countProject(query: ProjectQueryParams): Promise<number>;
  updateProject(id: number, projectData: ProjectUpdatePayload): Promise<Project>;
  deleteProject(id: number): Promise<Project>;
}
