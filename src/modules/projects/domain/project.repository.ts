import {
  Project,
  ProjectQueryParams,
  ProjectCreatePayload,
  ProjectUpdatePayload,
  ProjectTagPayload,
  ProjectMemberPayload,
  ProjectCoursePayload,
} from "./project";

export interface IProjectRepository {
  createProject(
    projectData: ProjectCreatePayload,
  ): Promise<Project>;
  createProjectTag(
    data: ProjectTagPayload[],
  ): Promise<void>;
  deleteProjectTag(
    projectID: number,
    tagID: number[],
  ): Promise<void>;
  createProjectMember(
    data: ProjectMemberPayload[],
  ): Promise<void>;
  deleteProjectMember(
    projectID: number,
    userID: number[],
  ): Promise<void>;
  createProjectCourse(
    data: ProjectCoursePayload[],
  ): Promise<void>;
  deleteProjectCourse(
    projectID: number,
    courseID: number[],
  ): Promise<void>;
  getProject(query: ProjectQueryParams): Promise<Project[]>
  getProjectById(id: number): Promise<Project | null>;
  countProject(query: ProjectQueryParams): Promise<number>
  updateProject(
    id: number,
    projectData: ProjectUpdatePayload,
  ): Promise<Project>;
  deleteProject(id: number): Promise<Project>;
}
