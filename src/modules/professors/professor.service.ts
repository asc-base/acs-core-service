import { IUserRepository } from "../users/domain/user.repository";
import {
  CreateProfessorDTO,
  Professor,
  ProfessorDTO,
  ProfessorQueryParams,
  ProfessorUpdateDTO,
  ProfessorCreatePayload,
  ProfessorUpdatePayload,
} from "./domain/professor";
import { UpdateUserModel } from "../users/domain/user";
import { IProfessorRepository } from "./domain/professor.repository";
import { IProfessorFactory } from "./profressor.factory";
import { CreateUserModel } from "../users/domain/user";
import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";
import { PageableType } from "../../core/models";
import { IUnitOfWork } from "../../core/uow/uow.interface";
import { ProfileImageStorage, StoredImage } from "../../infrastructure/profile-image-storage";
import { validateProfileImage } from "../users/profile-image-validation";

export function normalizeResearchProfileURL(value: string | null | undefined) {
  if (value == null) return value;
  const normalized = value.trim();
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    if (
      /^https?:\/\//i.test(normalized) &&
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname
    ) {
      return normalized;
    }
  } catch {
    // Fall through to the validation error below.
  }

  throw new AppError(
    ErrorCode.VALIDATION_ERROR,
    "Research profile must be a full HTTP or HTTPS URL",
    400,
  );
}

interface IProfessorService {
  createProfessor(
    data: CreateProfessorDTO,
  ): Promise<ProfessorDTO>;
  getProfessors(
    query: ProfessorQueryParams,
  ): Promise<PageableType<typeof ProfessorDTO>>;
  getProfessorById(id: number): Promise<ProfessorDTO | null>;
  updateProfessor(
    professorID: number,
    data: Partial<CreateProfessorDTO>,
  ): Promise<ProfessorDTO | null>;
}

export class ProfessorService implements IProfessorService {
  constructor(
    private readonly professorRepository: IProfessorRepository,
    private readonly userRepository: IUserRepository,
    private readonly professorFactory: IProfessorFactory,
    private readonly storage: ProfileImageStorage,
    private readonly unitOfWork: IUnitOfWork,
  ) { }

  async createProfessor(
    data: CreateProfessorDTO,
  ): Promise<ProfessorDTO> {
    const {
      imageFile,
      firstNameTh,
      firstNameEn,
      lastNameTh,
      lastNameEn,
      email,
      imageFocalPointX,
      imageFocalPointY,
      prefixID,
      research_profile,
      educations,
      ...rawProfessorData
    } = data;
    const researchProfile = normalizeResearchProfileURL(research_profile);
    let storedImage: StoredImage | null = null;
    try {
      const existingUser = await this.userRepository.getUserByEmail(email);
      const existingProfessor = existingUser
        ? await this.professorRepository.getProfessorByUserId(existingUser.id)
        : null;
      if (existingProfessor?.deletedAt === null) {
        throw new AppError(
          ErrorCode.DUPLICATE_DATA_ERROR,
          "Professor with this email already exists",
          400,
        );
      }

      const contentType = imageFile
        ? await validateProfileImage(imageFile)
        : null;
      if (imageFile && contentType) {
        storedImage = await this.storage.upload(imageFile, contentType);
      }

      const professor = await this.unitOfWork.runInTransaction(async (tx) => {
        const image = storedImage
          ? await tx.imageMedia.create({
              ...storedImage,
              fileName: imageFile!.name,
              contentType: contentType!,
              fileSize: imageFile!.size,
            })
          : null;
        const userData: UpdateUserModel = {
          firstNameTh,
          prefixID,
          lastNameTh,
          firstNameEn,
          lastNameEn,
          ...(image && {
            imageID: image.id,
            imageUrl: storedImage!.imageUrl,
            imageFocalPointX: imageFocalPointX ?? null,
            imageFocalPointY: imageFocalPointY ?? null,
          }),
          ...(!image && { imageFocalPointX, imageFocalPointY }),
        };

        let user;
        if (existingUser) {
          user = await tx.user.updateUser(existingUser.id, userData);
        } else {
          const createUserData: CreateUserModel = {
            firstNameTh,
            lastNameTh,
            firstNameEn,
            lastNameEn,
            prefixID,
            email,
            imageID: image?.id ?? null,
            imageUrl: storedImage?.imageUrl ?? null,
            imageFocalPointX: image ? imageFocalPointX ?? null : imageFocalPointX,
            imageFocalPointY: image ? imageFocalPointY ?? null : imageFocalPointY,
          };
          user = await tx.user.createUser(createUserData);
          await tx.user.assignUserRole({ userID: user.id, roleID: 3 });
        }

        let professor: Professor;
        if (existingProfessor) {
          professor = await tx.professor.updateProfessor(existingProfessor.id, {
            ...rawProfessorData,
            ...(educations !== undefined && {
              educations: splitEducations(educations),
            }),
            researchProfile,
            deletedAt: null,
          });
        } else {
          const professorData: ProfessorCreatePayload = {
            ...rawProfessorData,
            educations: splitEducations(educations),
            researchProfile: researchProfile ?? null,
            userID: user.id,
          };
          professor = await tx.professor.createProfessor(professorData);
          if (
            existingUser &&
            !existingUser.userRoles?.some((role) => role.roleID === 3)
          ) {
            await tx.user.assignUserRole({ userID: user.id, roleID: 3 });
          }
        }
        professor.user = user;
        return this.professorFactory.mapProfessorToDTO(professor);
      });
      return professor;
    } catch (error) {
      if (storedImage) {
        await this.storage
          .delete(storedImage.bucket, storedImage.fileKey)
          .catch((cleanupError) => {
            console.error("Failed to clean up profile image", {
              ...storedImage,
              error: cleanupError,
            });
          });
      }
      throw error;
    }
  }

  async getProfessors(
    query: ProfessorQueryParams,
  ): Promise<PageableType<typeof ProfessorDTO>> {
    const [professors, countProfessors] = await Promise.all([
      this.professorRepository.getProfessors(query),
      this.professorRepository.countProfessors(query),
    ]);

    return {
      rows: this.professorFactory.mapPrfessorListToDTO(professors),
      totalRecords: countProfessors,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  async getProfessorById(id: number): Promise<ProfessorDTO | null> {
    try {
      const professor = await this.professorRepository.getProfessorById(id);
      if (!professor) {
        return null;
      }

      return this.professorFactory.mapProfessorToDTO(professor);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async updateProfessor(
    professorID: number,
    data: ProfessorUpdateDTO,
  ): Promise<ProfessorDTO | null> {
    const {
      imageFile,
      phone,
      profRoom,
      educations,
      expertFields,
      research_profile,
      ...UserData
    } = data;
    const existing = await this.professorRepository.getProfessorById(professorID);
    if (!existing) return null;

    let storedImage: StoredImage | null = null;
    let imageContentType: string | null = null;
    try {
      if (imageFile) {
        imageContentType = await validateProfileImage(imageFile);
        storedImage = await this.storage.upload(imageFile, imageContentType);
      }

      const updatedProfessor: ProfessorUpdatePayload = {
        ...(phone !== undefined && { phone }),
        ...(profRoom !== undefined && { profRoom }),
        ...(educations !== undefined && {
          educations: splitEducations(educations),
        }),
        ...(expertFields !== undefined && { expertFields }),
        ...(research_profile !== undefined && {
          researchProfile: normalizeResearchProfileURL(research_profile),
        }),
      };

      const professor = await this.unitOfWork.runInTransaction(async (tx) => {
        const image = storedImage
          ? await tx.imageMedia.create({
              ...storedImage,
              fileName: imageFile!.name,
              contentType: imageContentType!,
              fileSize: imageFile!.size,
            })
          : null;
        const updatedUserData: UpdateUserModel = {
          ...UserData,
          ...(image && {
            imageID: image.id,
            imageUrl: storedImage!.imageUrl,
            imageFocalPointX:
              UserData.imageFocalPointX ?? existing.user.imageFocalPointX ?? null,
            imageFocalPointY:
              UserData.imageFocalPointY ?? existing.user.imageFocalPointY ?? null,
          }),
          ...(!image && { imageFocalPointX: UserData.imageFocalPointX, imageFocalPointY: UserData.imageFocalPointY }),
        };
        const updated = await tx.professor.updateProfessor(
          existing.id,
          updatedProfessor,
        );
        if (Object.values(updatedUserData).some((value) => value !== undefined)) {
          updated.user = await tx.user.updateUser(existing.userID, updatedUserData);
        }
        return this.professorFactory.mapProfessorToDTO(updated);
      });
      return professor;
    } catch (error) {
      if (storedImage) {
        await this.storage
          .delete(storedImage.bucket, storedImage.fileKey)
          .catch((cleanupError) => {
            console.error("Failed to clean up profile image", {
              ...storedImage,
              error: cleanupError,
            });
          });
      }
      throw error;
    }
  }

  async deleteProfessor(id: number): Promise<ProfessorDTO> {
    const professor = await this.professorRepository.deleteProfessor(id);
    if (!professor) {
      throw new AppError(ErrorCode.NOT_FOUND_ERROR, "Professor not found", 404);
    }
    return this.professorFactory.mapProfessorToDTO(professor);
  }
}

function splitEducations(educations: string | null | undefined): string[] {
  return educations?.split("/").map((education) => education.trim()).filter(Boolean) ?? [];
}
