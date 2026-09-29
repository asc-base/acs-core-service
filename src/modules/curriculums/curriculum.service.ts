import {
  CreateCurriculumDTO,
  CurriculumDTO,
  CurriculumQueryParams,
  UpdateCurriculumDTO,
  CurriculumCreatePayload,
  CurriculumUpdatePayload
} from "./domain/curriculum";
import { ICurriculumRepository } from "./domain/curriculum.repository";
import { SupabaseService } from "../../core/utils/supabase";
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
    private readonly storageService: SupabaseService,
  ) {}

  async createCurriculum(data: CreateCurriculumDTO): Promise<CurriculumDTO> {
    const { thumbnailFile, ...rest } = data;
    try {
      let uploadedThumbnailPath: string | null = null;
      if (!thumbnailFile) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "Thumbnail file is required",
          HttpStatusCode.BAD_REQUEST,
        );
      }

      uploadedThumbnailPath = await this.storageService.uploadFile(
        thumbnailFile,
        "curriculums",
      );

      const curriculumData: CurriculumCreatePayload = {
        ...rest,
        thumbnailURL: uploadedThumbnailPath,
      };

      const curriculum =
        await this.curriculumRepository.createCurriculum(curriculumData);

      return this.curriculumFactory.mapCurriculumToDTO(curriculum);
    } catch (error) {
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
    let updatedThumbnailPath = existingCurriculum.thumbnailURL;

    try {
      if (thumbnailFile) {
        updatedThumbnailPath = await this.storageService.uploadFile(
          thumbnailFile,
          "curriculums",
        );

        if (existingCurriculum.thumbnailURL) {
          try {
            const urlPattern = /\/public\/[^/]+\/(.+)$/;
            const match = existingCurriculum.thumbnailURL.match(urlPattern);
            
            if (match) {
              const oldFilePath = decodeURI(match[1]);
              await this.storageService.deleteFile(oldFilePath);
            }
          } catch (deleteError) {
            console.error("Failed to delete old thumbnail from Supabase:", deleteError);
          }
        }
      }

      const updatedData: CurriculumUpdatePayload = {
        ...rest,
        thumbnailURL: updatedThumbnailPath,
      };

      const updatedCurriculum = await this.curriculumRepository.updateCurriculum(id, updatedData);

      return this.curriculumFactory.mapCurriculumToDTO(updatedCurriculum);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async deleteCurriculum(id: number): Promise<CurriculumDTO> {
    const deletedCurriculum = await this.curriculumRepository.deleteCurriculum(id);
    
    return this.curriculumFactory.mapCurriculumToDTO(deletedCurriculum);
  }
}
