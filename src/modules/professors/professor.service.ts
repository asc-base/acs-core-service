import { SupabaseService } from "../../core/utils/supabase";
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
import { Prisma } from "../../generated/prisma/client";
import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";
import { HttpStatusCode } from "../../core/types/http";
import { PageableType } from "../../core/models";
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
    private readonly storage: SupabaseService,
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
      ...rawProfessorData
    } = data;
    let pathImage: string | null = null;
    try {
      if (imageFile) {
        pathImage = await this.storage.uploadFile(imageFile, "professors");
      }

      const existingUser = await this.userRepository.getUserByEmail(email);

      if (existingUser) {
        const existingProfessor =
          await this.professorRepository.getProfessorByUserId(existingUser.id);

        if (existingProfessor?.deletedAt === null) {
          throw new AppError(
            ErrorCode.DUPLICATE_DATA_ERROR,
            "Professor with this email already exists",
            400,
          );
        }

        if (existingProfessor) {
          const professorData: ProfessorUpdatePayload = {
            ...rawProfessorData,
            expertFields: rawProfessorData.expertFields,
            educations: rawProfessorData.educations,
            deletedAt: null,
          };

          const restoredProfessor =
            await this.professorRepository.updateProfessor(
              existingProfessor.id,
              professorData,
            );

          const updatedUserData: UpdateUserModel = {
            firstNameTh,
            prefixID,
            lastNameTh,
            firstNameEn,
            lastNameEn,
            imageFocalPointX,
            imageFocalPointY,
            ...(pathImage && { imageUrl: pathImage }),
          };

          const updatedUser = await this.userRepository.updateUser(
            existingUser.id,
            updatedUserData,
          );

          restoredProfessor.user = updatedUser;

          return this.professorFactory.mapProfessorToDTO(restoredProfessor);
        } else {
          const professorData: ProfessorCreatePayload = {
            ...rawProfessorData,
            expertFields: rawProfessorData.expertFields,
            educations: rawProfessorData.educations,
            userID: existingUser.id,
          };

          const newProfessor =
            await this.professorRepository.createProfessor(professorData);

          const hasProfessorRole = existingUser.userRoles?.some(
            (role) => role.roleID === 3,
          );

          if (!hasProfessorRole) {
            await this.userRepository.assignUserRole({
              userID: existingUser.id,
              roleID: 3,
            });
          }

          const updatedUserData: UpdateUserModel = {
            firstNameTh,
            prefixID,
            lastNameTh,
            firstNameEn,
            lastNameEn,
            imageFocalPointX,
            imageFocalPointY,
            ...(pathImage && { imageUrl: pathImage }),
          };

          const updatedUser = await this.userRepository.updateUser(
            existingUser.id,
            updatedUserData,
          );

          newProfessor.user = updatedUser;

          return this.professorFactory.mapProfessorToDTO(newProfessor);
        }
      }

      const userData: CreateUserModel = {
        firstNameTh,
        prefixID,
        lastNameTh,
        firstNameEn,
        lastNameEn,
        email,
        imageUrl: pathImage,
        imageFocalPointX,
        imageFocalPointY,
      };

      const user = await this.userRepository.createUser(userData);

      if (!user) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          "Failed to create user for professor",
          500,
        );
      }

      const role = await this.userRepository.assignUserRole({
        userID: user.id,
        roleID: 3,
      });

      if (!role) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          "Failed to assign role to student user",
        );
      }

      const professorData: ProfessorCreatePayload = {
        ...rawProfessorData,
        expertFields: rawProfessorData.expertFields,
        educations: rawProfessorData.educations,
        userID: user.id,
      };

      const professor =
        await this.professorRepository.createProfessor(professorData);

      return this.professorFactory.mapProfessorToDTO(professor);
    } catch (error) {
      console.log(error);
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
      ...UserData
    } = data;
    let pathImage: string | undefined = undefined;
    let professor: Professor | null;

    try {
      if (imageFile) {
        pathImage = await this.storage.uploadFile(imageFile, "professors");
      }

      const updatedProfessor: ProfessorUpdatePayload = {
        phone,
        profRoom,
        educations,
        expertFields,
      };

      professor = await this.professorRepository.updateProfessor(
        professorID,
        updatedProfessor,
      );

      if (!professor) {
        return null;
      }

      const updatedUserData: UpdateUserModel = {
        ...UserData,
        ...(pathImage && { imageUrl: pathImage }),
      };

      const user = await this.userRepository.updateUser(
        professor.userID,
        updatedUserData,
      );

      if (!user) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          "Failed to update user for professor",
          500,
        );
      }

      professor.user = user;

      return this.professorFactory.mapProfessorToDTO(professor);
    } catch (error) {
      console.log(error);
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        "Failed to update professor",
        HttpStatusCode.INTERNAL_SERVER_ERROR,
      );
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
