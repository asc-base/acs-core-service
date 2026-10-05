import {
  CreateCurriculumDTO,
  CurriculumDTO,
  CurriculumQueryParams,
  UpdateCurriculumDTO,
  CurriculumCreatePayload,
  CurriculumUpdatePayload
} from "./domain/curriculum";
import { ICurriculumRepository } from "./domain/curriculum.repository";
import { ProfileImageStorage, StoredImage } from "../../infrastructure/profile-image-storage";
import { detectImageContentType } from "../users/image-file-validation";
import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";
import { HttpStatusCode } from "../../core/types/http";
import { ICurriculumFactory } from "./curriculum.factory";
import { PageableType } from "../../core/models";
interface ICurriculumService {
  createCurriculum(data: CreateCurriculumDTO): Promise<CurriculumDTO>;
  getCurriculums(
    query: CurriculumQueryParams,
  ): Promise<PageableType<typeof CurriculumDTO>>;
  getCurriculumById(id: number): Promise<CurriculumDTO>;
  updateCurriculum(id: number, data: UpdateCurriculumDTO): Promise<CurriculumDTO>;
  deleteCurriculum(id: number): Promise<CurriculumDTO>;
}

export class CurriculumService implements ICurriculumService {
  constructor(
    private readonly curriculumRepository: ICurriculumRepository,
    private readonly curriculumFactory: ICurriculumFactory,
    private readonly storageService: ProfileImageStorage,
  ) {}

  async createCurriculum(data: CreateCurriculumDTO): Promise<CurriculumDTO> {
    const { thumbnailFile, ...rest } = data;
    let uploadedThumbnail: StoredImage | undefined;
    try {
      if (!thumbnailFile) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "Thumbnail file is required",
          HttpStatusCode.BAD_REQUEST,
        );
      }

      const contentType = await detectImageContentType(thumbnailFile);
      uploadedThumbnail = await this.storageService.upload(thumbnailFile, contentType, "curriculums/images");

      const curriculumData: CurriculumCreatePayload = {
        ...rest,
        thumbnailURL: uploadedThumbnail.imageUrl,
        thumbnailMedia: { ...uploadedThumbnail, fileName: thumbnailFile.name, contentType, fileSize: thumbnailFile.size },
      };

      const curriculum =
        await this.curriculumRepository.createCurriculum(curriculumData);

      return this.curriculumFactory.mapCurriculumToDTO(curriculum);
    } catch (error) {
      if (uploadedThumbnail) await this.storageService.delete(uploadedThumbnail.bucket, uploadedThumbnail.fileKey).catch(() => {});
      console.error(error);
      throw error;
    }
  }

  async getCurriculums(
    query: CurriculumQueryParams,
  ): Promise<PageableType<typeof CurriculumDTO>> {
    const [curriculums, countCurriculums] = await Promise.all([
      this.curriculumRepository.getCurriculums(query),
      this.curriculumRepository.countCurriculums(query),
    ]);

    return {
      rows: this.curriculumFactory.mapCurriculumsToDTOs(curriculums),
      totalRecords: countCurriculums,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  async getCurriculumById(id: number): Promise<CurriculumDTO> {
    const curriculum = await this.curriculumRepository.getCurriculumById(id);
    
    if (!curriculum) {
      throw new AppError(
        ErrorCode.NOT_FOUND_ERROR,
        "Curriculum not found",
        HttpStatusCode.NOT_FOUND,
      );
    }

    return this.curriculumFactory.mapCurriculumToDTO(curriculum);
  }

  async updateCurriculum(
    id: number,
    data: UpdateCurriculumDTO,
  ): Promise<CurriculumDTO> {
    const existingCurriculum = await this.curriculumRepository.getCurriculumById(id);
    
    if (!existingCurriculum) {
      throw new AppError(
        ErrorCode.NOT_FOUND_ERROR,
        "Curriculum not found",
        HttpStatusCode.NOT_FOUND,
      );
    }

    const { thumbnailFile, ...rest } = data;
    let updatedThumbnailPath = existingCurriculum.imageMedia?.imageUrl ?? existingCurriculum.thumbnailURL;
    let uploadedThumbnail: StoredImage | undefined;
    let uploadedContentType: string | undefined;

    try {
      if (thumbnailFile) {
        uploadedContentType = await detectImageContentType(thumbnailFile);
        uploadedThumbnail = await this.storageService.upload(thumbnailFile, uploadedContentType, "curriculums/images");
        updatedThumbnailPath = uploadedThumbnail.imageUrl;
      }

      const updatedData: CurriculumUpdatePayload = {
        ...rest,
        thumbnailURL: updatedThumbnailPath,
        ...(uploadedThumbnail && { thumbnailMedia: { ...uploadedThumbnail, fileName: thumbnailFile!.name, contentType: uploadedContentType!, fileSize: thumbnailFile!.size } }),
      };

      const updatedCurriculum = await this.curriculumRepository.updateCurriculum(id, updatedData);

      return this.curriculumFactory.mapCurriculumToDTO(updatedCurriculum);
    } catch (error) {
      if (uploadedThumbnail) await this.storageService.delete(uploadedThumbnail.bucket, uploadedThumbnail.fileKey).catch(() => {});
      console.error(error);
      throw error;
    }
  }

  async deleteCurriculum(id: number): Promise<CurriculumDTO> {
    const deletedCurriculum = await this.curriculumRepository.deleteCurriculum(id);
    
    return this.curriculumFactory.mapCurriculumToDTO(deletedCurriculum);
  }
}
