import { IProjectRepository } from "./domain/project.repository";
import {
  CreateProjectDTO,
  ProjectDTO,
  ProjectQueryParams,
  UpdateProjectDTO,
  ProjectCreatePayload,
  ProjectUpdatePayload,
  ProjectTagPayload,
  ProjectMemberPayload,
  ProjectCoursePayload,
} from "./domain/project";
import { SupabaseService } from "../../core/utils/supabase";
import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";
import { IProjectFactory } from "./project.factory";
import { PageableType } from "../../core/models";
import { HttpStatusCode } from "../../core/types/http";

interface IProjectService {
  createProject(projectData: CreateProjectDTO): Promise<ProjectDTO>;
  getProject(query: ProjectQueryParams): Promise<PageableType<typeof ProjectDTO>>;
  getProjectById(id: number): Promise<ProjectDTO | null>;
  updateProject(projectID: number, projectData: UpdateProjectDTO): Promise<ProjectDTO>;
  deleteProject(id: number): Promise<ProjectDTO | null>;
}

export class ProjectService implements IProjectService {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly storageService: SupabaseService,
    private readonly projectFactory: IProjectFactory,
  ) { }

  async createProject(projectData: CreateProjectDTO): Promise<ProjectDTO> {
    const {
      thumbnailFile,
      assets,
      tagsID,
      techStacks,
      members,
      coursesID,
      ...projectFields
    } = projectData;

    const assetURLs: string[] = [];

    if (!thumbnailFile) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Thumbnail file is required",
      );
    }

    if (assets.length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "At least one asset file is required",
      );
    }

    const thumbnailURL = await this.storageService.uploadFile(
      thumbnailFile,
      "project-thumbnails",
    );

    if (!thumbnailURL) {
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        "Failed to upload thumbnail",
      );
    }

    for (const asset of assets) {
      const assetURL = await this.storageService.uploadFile(
        asset,
        "project-assets",
      );
      if (!assetURL) {
        throw new AppError(ErrorCode.DATABASE_ERROR, "Failed to upload asset");
      }
      assetURLs.push(assetURL);
    }

    const assetsURLString = assetURLs.join(",");
    const techStackString = techStacks.join(",");

    const createPayload: ProjectCreatePayload = {
      ...projectFields,
      thumbnailURL: thumbnailURL,
      assetsURL: assetsURLString,
      techStacks: techStackString,
    }

    const createdProject = await this.projectRepository.createProject(createPayload);

    const projectTagsData: ProjectTagPayload[] = Array.from(new Set(tagsID)).map((tagID) => ({
      projectID: createdProject.id,
      tagID,
    }));

    const projectMembersData: ProjectMemberPayload[] = members.map((member) => ({
      projectID: createdProject.id,
      userID: member.userID,
      roleID: member.roleID,
    }));

    const projectCourseData: ProjectCoursePayload[] = Array.from(new Set(coursesID)).map((courseID) => ({
      projectID: createdProject.id,
      courseID,
    }));

    await this.projectRepository.createProjectMember(projectMembersData);

    await this.projectRepository.createProjectTag(projectTagsData);

    await this.projectRepository.createProjectCourse(projectCourseData);

    return this.projectFactory.mapProjectToDTO(createdProject);
  }

  async getProject(query: ProjectQueryParams): Promise<PageableType<typeof ProjectDTO>> {
    const [ProjectList, countProject] = await Promise.all([
      this.projectRepository.getProject(query),
      this.projectRepository.countProject(query),
    ]);

    return {
      rows: this.projectFactory.mapProjectListToDTOList(ProjectList),
      totalRecords: countProject,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  async getProjectById(id: number): Promise<ProjectDTO | null> {
    try {
      const project = await this.projectRepository.getProjectById(id);
      if (!project) {
        return null;
      }
      return this.projectFactory.mapProjectToDTO(project);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async updateProject(id: number, projectData: UpdateProjectDTO): Promise<ProjectDTO> {
    const {
      thumbnailFile,
      assets,
      newtagsID = [],
      deletedtagsID = [],
      techStacks,
      newMembers = [],
      deletedmembersID = [],
      newCoursesID = [],
      deletedCoursesID = [],
      ...projectFields
    } = projectData;
    const existingProject = await this.projectRepository.getProjectById(id);
    if (!existingProject) {
      throw new AppError(ErrorCode.NOT_FOUND, "Project not found");
    }

    let thumbnailURL = existingProject.thumbnailURL;

    if (thumbnailFile) {
      const uploaded = await this.storageService.uploadFile(
        thumbnailFile,
        "project-thumbnails"
      );
      if (!uploaded) {
        throw new AppError(ErrorCode.DATABASE_ERROR, "Failed to upload thumbnail");
      }
      thumbnailURL = uploaded;
    }

    let assetURLs: string[] = existingProject.assetsURL
      ? existingProject.assetsURL.split(",")
      : [];

    if (assets && assets.length > 0) {
      for (const asset of assets) {
        const uploaded = await this.storageService.uploadFile(
          asset,
          "project-assets"
        );
        if (!uploaded) {
          throw new AppError(ErrorCode.DATABASE_ERROR, "Failed to upload asset");
        }
        assetURLs.push(uploaded);
      }
    }

    const assetsURLString = assetURLs.join(",");

    const techStackString = techStacks
      ? techStacks.join(",")
      : existingProject.techStacks;

    const updatedData: ProjectUpdatePayload = {
      ...projectFields,
      thumbnailURL,
      assetsURL: assetsURLString,
      techStacks: techStackString,
      updatedAt: new Date(),
    }
    const updatedProject = await this.projectRepository.updateProject(id, updatedData);

    if (newtagsID.length > 0) {
      const data = Array.from(new Set(newtagsID)).map((tagID) => ({
        projectID: id,
        tagID,
      }));
      await this.projectRepository.createProjectTag(data);
    }

    if (deletedtagsID.length > 0) {
      await this.projectRepository.deleteProjectTag(id, deletedtagsID);
    }

    if (newMembers.length > 0) {
      const data = newMembers.map((member) => ({
        projectID: id,
        userID: member.userID,
        roleID: member.roleID,
      }));
      await this.projectRepository.createProjectMember(data);
    }

    if (deletedmembersID.length > 0) {
      await this.projectRepository.deleteProjectMember(id, deletedmembersID);
    }

    if (newCoursesID.length > 0) {
      const data = Array.from(new Set(newCoursesID)).map((courseID) => ({
        projectID: id,
        courseID,
      }));
      await this.projectRepository.createProjectCourse(data);
    }

    if (deletedCoursesID.length > 0) {
      await this.projectRepository.deleteProjectCourse(id, deletedCoursesID);
    }

    return this.projectFactory.mapProjectToDTO(updatedProject);
  }

  async deleteProject(id: number): Promise<ProjectDTO | null> {
    const project = await this.projectRepository.deleteProject(id);
    if (!project) {
      throw new AppError(
        ErrorCode.NOT_FOUND_ERROR,
        "Project not found",
        HttpStatusCode.NOT_FOUND,
      );
    }
    return this.projectFactory.mapProjectToDTO(project);
  }
}
