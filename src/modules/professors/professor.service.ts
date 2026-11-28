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
import { CreateUserModel, UpdateUserModel, User } from "../users/domain/user";
import { IProfessorRepository } from "./domain/professor.repository";
import { IProfessorFactory } from "./profressor.factory";
import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";
import { PageableType } from "../../core/models";
import { IUnitOfWork } from "../../core/uow/uow.interface";
import {
  ProfileImageStorage,
  StoredImage,
} from "../../infrastructure/profile-image-storage";
import { validateProfileImage } from "../users/profile-image-validation";

interface IProfessorService {
  createProfessor(data: CreateProfessorDTO): Promise<ProfessorDTO>;
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
  ) {}

  async createProfessor(data: CreateProfessorDTO): Promise<ProfessorDTO> {
    const prepared = this.prepareCreateData(data);
    let storedImage: StoredImage | null = null;
    try {
      const { existingUser, existingProfessor } =
        await this.findExistingProfessor(prepared.email);
      this.ensureProfessorIsNotActive(existingProfessor);
      const uploaded = await this.uploadImage(prepared.imageFile);
      storedImage = uploaded.storedImage;
      return await this.unitOfWork.runInTransaction((tx) =>
        this.createProfessorInTransaction(
          tx,
          prepared,
          existingUser,
          existingProfessor,
          uploaded,
        ),
      );
    } catch (error) {
      await this.cleanupImage(storedImage);
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
      pageSize: query.pageSize || null,
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
    const prepared = this.prepareUpdateData(data);
    const existing =
      await this.professorRepository.getProfessorById(professorID);
    if (!existing) return null;

    let storedImage: StoredImage | null = null;
    try {
      const uploaded = await this.uploadImage(prepared.imageFile);
      storedImage = uploaded.storedImage;
      return await this.unitOfWork.runInTransaction((tx) =>
        this.updateProfessorInTransaction(tx, existing, prepared, uploaded),
      );
    } catch (error) {
      await this.cleanupImage(storedImage);
      throw error;
    }
  }

  private prepareCreateData(data: CreateProfessorDTO) {
    const {
      imageFile,
      firstNameTh,
      firstNameEn,
      lastNameTh,
      lastNameEn,
      nickName,
      email,
      imageFocalPointX,
      imageFocalPointY,
      prefixID,
      research_profile,
      educations,
      phone,
      profRoom,
      expertFields,
      personnelType,
    } = data;
    return {
      imageFile,
      firstNameTh,
      firstNameEn,
      lastNameTh,
      lastNameEn,
      nickName,
      email,
      imageFocalPointX,
      imageFocalPointY,
      prefixID,
      educations,
      phone,
      profRoom,
      expertFields,
      personnelType,
      researchProfile: this.normalizeResearchProfileURL(research_profile),
    };
  }

  private prepareUpdateData(data: ProfessorUpdateDTO) {
    const {
      imageFile,
      phone,
      profRoom,
      educations,
      expertFields,
      research_profile,
      personnelType,
      ...userData
    } = data;
    const professorData: ProfessorUpdatePayload = {
      ...(personnelType !== undefined && { personnelType }),
      ...(phone !== undefined && { phone }),
      ...(profRoom !== undefined && { profRoom }),
      ...(educations !== undefined && {
        educations: splitEducations(educations),
      }),
      ...(expertFields !== undefined && { expertFields }),
      ...(research_profile !== undefined && {
        researchProfile: this.normalizeResearchProfileURL(research_profile),
      }),
    };
    return { imageFile, professorData, userData };
  }

  private async updateProfessorInTransaction(
    tx: IUnitOfWork,
    existing: Professor,
    data: ReturnType<ProfessorService["prepareUpdateData"]>,
    uploaded: Awaited<ReturnType<ProfessorService["uploadImage"]>>,
  ): Promise<ProfessorDTO> {
    const image = await this.createImageMedia(tx, data.imageFile, uploaded);
    const updatedUserData: UpdateUserModel = {
      ...data.userData,
      ...(image && {
        imageID: image.id,
        imageUrl: uploaded.storedImage!.imageUrl,
        imageFocalPointX:
          data.userData.imageFocalPointX ??
          existing.user.imageFocalPointX ??
          null,
        imageFocalPointY:
          data.userData.imageFocalPointY ??
          existing.user.imageFocalPointY ??
          null,
      }),
      ...(!image && {
        imageFocalPointX: data.userData.imageFocalPointX,
        imageFocalPointY: data.userData.imageFocalPointY,
      }),
    };
    const updated = await tx.professor.updateProfessor(
      existing.id,
      data.professorData,
    );
    if (Object.values(updatedUserData).some((value) => value !== undefined)) {
      updated.user = await tx.user.updateUser(existing.userID, updatedUserData);
    }
    return this.professorFactory.mapProfessorToDTO(updated);
  }

  private async createImageMedia(
    tx: IUnitOfWork,
    imageFile: File | null | undefined,
    uploaded: Awaited<ReturnType<ProfessorService["uploadImage"]>>,
  ) {
    if (!uploaded.storedImage || !imageFile) return null;
    return tx.imageMedia.create({
      ...uploaded.storedImage,
      fileName: imageFile.name,
      contentType: uploaded.contentType!,
      fileSize: imageFile.size,
    });
  }

  private async findExistingProfessor(email: string) {
    const existingUser = await this.userRepository.getUserByEmail(email);
    const existingProfessor = existingUser
      ? await this.professorRepository.getProfessorByUserId(existingUser.id)
      : null;
    return { existingUser, existingProfessor };
  }

  private ensureProfessorIsNotActive(
    existingProfessor: Professor | null,
  ): void {
    if (existingProfessor?.deletedAt === null) {
      throw new AppError(
        ErrorCode.DUPLICATE_DATA_ERROR,
        "Professor with this email already exists",
        400,
      );
    }
  }

  private async uploadImage(imageFile: File | null | undefined) {
    if (!imageFile) return { storedImage: null, contentType: null };
    const contentType = await validateProfileImage(imageFile);
    const storedImage = await this.storage.upload(imageFile, contentType);
    return { storedImage, contentType };
  }

  private async createProfessorInTransaction(
    tx: IUnitOfWork,
    data: ReturnType<ProfessorService["prepareCreateData"]>,
    existingUser: User | null,
    existingProfessor: Professor | null,
    uploaded: Awaited<ReturnType<ProfessorService["uploadImage"]>>,
  ): Promise<ProfessorDTO> {
    const image = await this.createImageMedia(tx, data.imageFile, uploaded);
    const user = await this.saveProfessorUser(
      tx,
      data,
      existingUser,
      image,
      uploaded.storedImage,
    );
    const professor = await this.saveProfessorProfile(
      tx,
      data,
      existingUser,
      existingProfessor,
      user.id,
    );
    professor.user = user;
    return this.professorFactory.mapProfessorToDTO(professor);
  }

  private async saveProfessorUser(
    tx: IUnitOfWork,
    data: ReturnType<ProfessorService["prepareCreateData"]>,
    existingUser: User | null,
    image: Awaited<ReturnType<IUnitOfWork["imageMedia"]["create"]>> | null,
    storedImage: StoredImage | null,
  ): Promise<User> {
    const {
      firstNameTh,
      firstNameEn,
      lastNameTh,
      lastNameEn,
      nickName,
      prefixID,
      email,
      imageFocalPointX,
      imageFocalPointY,
    } = data;
    const userData: UpdateUserModel = {
      firstNameTh,
      firstNameEn,
      lastNameTh,
      lastNameEn,
      nickName,
      prefixID,
      ...(image && {
        imageID: image.id,
        imageUrl: storedImage!.imageUrl,
        imageFocalPointX: imageFocalPointX ?? null,
        imageFocalPointY: imageFocalPointY ?? null,
      }),
      ...(!image && { imageFocalPointX, imageFocalPointY }),
    };
    if (existingUser) return tx.user.updateUser(existingUser.id, userData);

    const createUserData: CreateUserModel = {
      firstNameTh,
      firstNameEn,
      lastNameTh,
      lastNameEn,
      nickName,
      prefixID,
      email,
      imageID: image?.id ?? null,
      imageUrl: storedImage?.imageUrl ?? null,
      imageFocalPointX: image ? (imageFocalPointX ?? null) : imageFocalPointX,
      imageFocalPointY: image ? (imageFocalPointY ?? null) : imageFocalPointY,
    };
    const user = await tx.user.createUser(createUserData);
    await tx.user.assignUserRole({ userID: user.id, roleID: 3 });
    return user;
  }

  private async saveProfessorProfile(
    tx: IUnitOfWork,
    data: ReturnType<ProfessorService["prepareCreateData"]>,
    existingUser: User | null,
    existingProfessor: Professor | null,
    userID: number,
  ): Promise<Professor> {
    const {
      phone,
      profRoom,
      expertFields,
      personnelType,
      educations,
      researchProfile,
    } = data;
    if (existingProfessor) {
      return tx.professor.updateProfessor(existingProfessor.id, {
        phone,
        profRoom,
        expertFields,
        personnelType,
        ...(educations !== undefined && {
          educations: splitEducations(educations),
        }),
        researchProfile,
        deletedAt: null,
      });
    }
    const professorData: ProfessorCreatePayload = {
      phone,
      profRoom,
      expertFields,
      personnelType,
      educations: splitEducations(educations),
      researchProfile: researchProfile ?? null,
      userID,
    };
    const professor = await tx.professor.createProfessor(professorData);
    if (
      existingUser &&
      !existingUser.userRoles?.some((role) => role.roleID === 3)
    ) {
      await tx.user.assignUserRole({ userID, roleID: 3 });
    }
    return professor;
  }

  private normalizeResearchProfileURL(value: string | null | undefined) {
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

  private async cleanupImage(storedImage: StoredImage | null): Promise<void> {
    if (!storedImage) return;
    await this.storage
      .delete(storedImage.bucket, storedImage.fileKey)
      .catch((cleanupError) => {
        console.error("Failed to clean up profile image", {
          ...storedImage,
          error: cleanupError,
        });
      });
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
  return (
    educations
      ?.split("/")
      .map((education) => education.trim())
      .filter(Boolean) ?? []
  );
}
