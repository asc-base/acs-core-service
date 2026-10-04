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
import { ProfileImageStorage, StoredImage } from "../../infrastructure/profile-image-storage";
import { detectImageContentType } from "../users/image-file-validation";
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
    private readonly storageService: ProfileImageStorage,
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

    const uploadedMedia: StoredImage[] = [];
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

    const thumbnailContentType = await detectImageContentType(thumbnailFile);
    let thumbnailMedia: StoredImage;
    let projectCreated = false;
    try {
      thumbnailMedia = await this.storageService.upload(thumbnailFile, thumbnailContentType, "projects/images");
      uploadedMedia.push(thumbnailMedia);
      const galleryMedia = [];
      for (const asset of assets) {
        const contentType = await detectImageContentType(asset);
        const media = await this.storageService.upload(asset, contentType, "projects/images");
        uploadedMedia.push(media);
        galleryMedia.push({ ...media, fileName: asset.name, contentType, fileSize: asset.size, sortOrder: galleryMedia.length });
        assetURLs.push(media.imageUrl);
      }

    const assetsURLString = assetURLs.join(",");
    const techStackString = techStacks.join(",");

      const createPayload: ProjectCreatePayload = {
        ...projectFields,
        thumbnailURL: thumbnailMedia.imageUrl,
        thumbnailMedia: { ...thumbnailMedia, fileName: thumbnailFile.name, contentType: thumbnailContentType, fileSize: thumbnailFile.size },
        galleryMedia,
        assetsURL: assetsURLString,
        techStacks: techStackString,
      };

      const createdProject = await this.projectRepository.createProject(createPayload);
      projectCreated = true;

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
    } catch (error) {
      if (!projectCreated) await Promise.all(uploadedMedia.map((media) => this.storageService.delete(media.bucket, media.fileKey).catch(() => {})));
      throw error;
    }
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

    const uploadedMedia: StoredImage[] = [];
    let mediaCommitted = false;
    let updatedProject: Awaited<ReturnType<IProjectRepository["updateProject"]>>;
    try {
    let thumbnailURL = existingProject.imageMedia?.imageUrl ?? existingProject.thumbnailURL;
    let thumbnailMedia: StoredImage | undefined;
    let thumbnailContentType: string | undefined;

    if (thumbnailFile) {
      thumbnailContentType = await detectImageContentType(thumbnailFile);
      thumbnailMedia = await this.storageService.upload(thumbnailFile, thumbnailContentType, "projects/images");
      uploadedMedia.push(thumbnailMedia);
      thumbnailURL = thumbnailMedia.imageUrl;
    }

    const assetURLs: string[] = existingProject.assetsURL
      ? existingProject.assetsURL.split(",").filter(Boolean)
      : [];

    const galleryMedia = [];
    if (assets && assets.length > 0) {
      for (const asset of assets) {
        const contentType = await detectImageContentType(asset);
        const uploaded = await this.storageService.upload(asset, contentType, "projects/images");
        uploadedMedia.push(uploaded);
        galleryMedia.push({ ...uploaded, fileName: asset.name, contentType, fileSize: asset.size, sortOrder: assetURLs.length });
        assetURLs.push(uploaded.imageUrl);
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
      ...(thumbnailMedia && { thumbnailMedia: { ...thumbnailMedia, fileName: thumbnailFile!.name, contentType: thumbnailContentType!, fileSize: thumbnailFile!.size } }),
      ...(galleryMedia.length && { galleryMedia }),
      techStacks: techStackString,
      updatedAt: new Date(),
    }
      updatedProject = await this.projectRepository.updateProject(id, updatedData);
      mediaCommitted = true;
    } catch (error) {
      if (!mediaCommitted) await Promise.all(uploadedMedia.map((media) => this.storageService.delete(media.bucket, media.fileKey).catch(() => {})));
      throw error;
    }

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
