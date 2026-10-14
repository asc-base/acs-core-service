import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";
import { HttpStatusCode } from "../../core/types/http";
import { ProfileImageStorage, StoredImage } from "../../infrastructure/profile-image-storage";
import { detectImageContentType } from "../users/image-file-validation";
import type { StoredImageMedia } from "../users/domain/image-media";
import { IProjectRepository } from "./domain/project.repository";
import {
  CreateProjectDTO,
  ProjectDTO,
  ProjectImageSource,
  ProjectImageWrite,
  ProjectQueryParams,
  UpdateProjectDTO,
  ProjectCreatePayload,
  ProjectUpdatePayload,
} from "./domain/project";
import { IProjectFactory } from "./project.factory";
import { PageableType } from "../../core/models";

function validationError(message: string): never {
  throw new AppError(ErrorCode.VALIDATION_ERROR, message, HttpStatusCode.BAD_REQUEST);
}

function resolveGallery(sources: ProjectImageSource[], assets: File[]) {
  const indexes = sources.flatMap((source) => "fileIndex" in source ? [source.fileIndex] : []);
  if (new Set(indexes).size !== indexes.length || indexes.some((index) => index >= assets.length)) {
    validationError("Gallery contains an invalid or duplicate asset index");
  }
  if (indexes.length !== assets.length || new Set(indexes).size !== assets.length) {
    validationError("Every uploaded asset must appear once in the gallery");
  }
}

function normalizeTechStacks(names: string[]) {
  const cleanNames = names.map((name) => name.trim());
  if (cleanNames.some((name) => !name)) validationError("Tech stack names cannot be blank");
  return [...new Set(cleanNames)];
}

export class ProjectService {
  constructor(
    private readonly projectRepository: IProjectRepository,
    private readonly storageService: ProfileImageStorage,
    private readonly projectFactory: IProjectFactory,
  ) {}

  async createProject(
    data: CreateProjectDTO,
    files: { thumbnailFile?: File; assets?: File[] },
  ): Promise<ProjectDTO> {
    const thumbnailFile = files.thumbnailFile;
    const assets = files.assets ?? [];
    if (!thumbnailFile) validationError("Thumbnail file is required");
    if (!assets.length || assets.length > 10) validationError("A project requires between 1 and 10 gallery images");
    resolveGallery(data.gallery, assets);

    const uploadedMedia: StoredImage[] = [];
    let committed = false;
    try {
      const thumbnailMedia = await this.upload(thumbnailFile, uploadedMedia);
      const galleryFiles: StoredImageMedia[] = [];
      for (const asset of assets) galleryFiles.push(await this.upload(asset, uploadedMedia));
      const payload: ProjectCreatePayload = {
        ...data,
        figmaURL: data.figmaURL ?? null,
        techStacks: normalizeTechStacks(data.techStacks),
        thumbnailMedia,
        galleryImages: data.gallery.map(({ fileIndex }) => ({ media: galleryFiles[fileIndex]! })),
      };
      const project = await this.projectRepository.createProject(payload);
      committed = true;
      return this.projectFactory.mapProjectToDTO(project);
    } catch (error) {
      if (!committed) await this.cleanupUploadedMedia(uploadedMedia);
      throw error;
    }
  }

  async getProject(query: ProjectQueryParams): Promise<PageableType<typeof ProjectDTO>> {
    const [projects, totalRecords] = await Promise.all([
      this.projectRepository.getProject(query),
      this.projectRepository.countProject(query),
    ]);
    return {
      rows: this.projectFactory.mapProjectListToDTOList(projects),
      totalRecords,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    };
  }

  async getProjectById(id: number): Promise<ProjectDTO | null> {
    const project = await this.projectRepository.getProjectById(id);
    return project ? this.projectFactory.mapProjectToDTO(project) : null;
  }

  async updateProject(id: number, data: UpdateProjectDTO, files: { thumbnailFile?: File; assets?: File[] } = {}): Promise<ProjectDTO> {
    const existingProject = await this.projectRepository.getProjectById(id);
    if (!existingProject) {
      throw new AppError(ErrorCode.NOT_FOUND_ERROR, "Project not found", HttpStatusCode.NOT_FOUND);
    }

    const assets = files.assets ?? [];
    if (assets.length > 10) validationError("A project cannot contain more than 10 gallery images");
    if (data.gallery?.length === 0) {
      validationError("A project requires at least one gallery image");
    }
    if (data.gallery !== undefined) resolveGallery(data.gallery, assets);
    else if (assets.length) validationError("Gallery order is required when uploading assets");

    const uploadedMedia: StoredImage[] = [];
    let committed = false;
    try {
      const thumbnailMedia = files.thumbnailFile
        ? await this.upload(files.thumbnailFile, uploadedMedia)
        : undefined;
      const galleryFiles: StoredImageMedia[] = [];
      for (const asset of assets) galleryFiles.push(await this.upload(asset, uploadedMedia));
      const galleryImages: ProjectImageWrite[] | undefined = data.gallery?.map((source) =>
        "imageID" in source
          ? { imageID: source.imageID }
          : { media: galleryFiles[source.fileIndex]! },
      );
      const payload: ProjectUpdatePayload = {
        ...data,
        ...(data.figmaURL !== undefined && { figmaURL: data.figmaURL }),
        ...(data.techStacks !== undefined && { techStacks: normalizeTechStacks(data.techStacks) }),
        ...(thumbnailMedia && { thumbnailMedia }),
        ...(galleryImages && { galleryImages }),
        updatedAt: new Date(),
      };
      const project = await this.projectRepository.updateProject(id, payload);
      committed = true;
      return this.projectFactory.mapProjectToDTO(project);
    } catch (error) {
      if (!committed) await this.cleanupUploadedMedia(uploadedMedia);
      throw error;
    }
  }

  async deleteProject(id: number): Promise<ProjectDTO> {
    const project = await this.projectRepository.deleteProject(id);
    return this.projectFactory.mapProjectToDTO(project);
  }

  private async upload(file: File, uploadedMedia: StoredImage[]) {
    const contentType = await detectImageContentType(file);
    const media = await this.storageService.upload(file, contentType, "projects/images");
    uploadedMedia.push(media);
    return {
      ...media,
      fileName: file.name,
      contentType,
      fileSize: file.size,
    };
  }

  private async cleanupUploadedMedia(media: StoredImage[]) {
    const cleanupResults = await Promise.allSettled(
      media.map((image) => this.storageService.delete(image.bucket, image.fileKey)),
    );
    cleanupResults.forEach((result, index) => {
      if (result.status === "rejected") {
        // Report failed cleanup so an operator can remove the orphaned storage object.
        // eslint-disable-next-line no-console
        console.error("Failed to remove project media after a failed write", {
          imageUrl: media[index]?.imageUrl,
          error: result.reason,
        });
      }
    });
  }
}
