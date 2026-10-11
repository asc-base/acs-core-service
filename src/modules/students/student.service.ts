import {
  CreateStudentDTO,
  StudentDTO,
  StudentQueryParams,
  StudentUpdateDTO,
  StudentCreatePayload,
  StudentUpdatePayload,
  CreateStudent,
} from "./domain/student";
import { parse } from "csv-parse/sync";
import * as xlsx from "xlsx";
import { Value } from "@sinclair/typebox/value";
import { IStudentRepository } from "./domain/student.repository";
import { CreateUserModel, UpdateUserModel } from "../users/domain/user";
import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";
import { IStudentFactory } from "./student.factory";
import { PageableType } from "../../core/models";
import { IUnitOfWork } from "../../core/uow/uow.interface";
import { ProfileImageStorage, StoredImage } from "../../infrastructure/profile-image-storage";
import { validateProfileImage } from "../users/profile-image-validation";

interface IStudentService {
  createStudent(data: CreateStudentDTO): Promise<StudentDTO>;
  getStudents(
    query: StudentQueryParams,
  ): Promise<PageableType<typeof StudentDTO>>;
  getStudentById(id: number): Promise<StudentDTO | null>;
  deleteStudent(id: number): Promise<StudentDTO>;
  updateStudent(
    studentID: number,
    data: StudentUpdateDTO,
    actor: { userID: number; isAdmin: boolean },
  ): Promise<StudentDTO>;
  importStudentsFromFile(
    file: File,
    classBookID: number,
  ): Promise<void>;
}

export class StudentService implements IStudentService {
  constructor(
    private readonly studentRepository: IStudentRepository,
    private readonly storage: ProfileImageStorage,
    private readonly studentFactory: IStudentFactory,
    private readonly unitOfWork: IUnitOfWork,
  ) { }

  async createStudent(
    data: CreateStudentDTO,
  ): Promise<StudentDTO> {
    const {
      imageFile,
      prefixID,
      email,
      nickName,
      firstNameTh,
      lastNameTh,
      firstNameEn,
      lastNameEn,
      skills,
      imageFocalPointX,
      imageFocalPointY,
      ...studentData
    } = data;
    let storedImage: StoredImage | null = null;
    let imageContentType: string | null = null;
    try {
      if (imageFile) {
        imageContentType = await validateProfileImage(imageFile);
        storedImage = await this.storage.upload(imageFile, imageContentType);
      }

      const student = await this.unitOfWork.runInTransaction(async (tx) => {
        const image = storedImage
          ? await tx.imageMedia.create({
              ...storedImage,
              fileName: imageFile!.name,
              contentType: imageContentType!,
              fileSize: imageFile!.size,
            })
          : null;
        const rawUserData: CreateUserModel = {
          prefixID,
          email,
          firstNameTh,
          lastNameTh,
          nickName,
          firstNameEn,
          lastNameEn,
          imageID: image?.id ?? null,
          imageUrl: storedImage?.imageUrl ?? null,
          imageFocalPointX,
          imageFocalPointY,
        };
        const user = await tx.user.createUser(rawUserData);
        await tx.user.assignUserRole({ userID: user.id, roleID: 2 });
        const rawStudentData: StudentCreatePayload = {
          ...studentData,
          skills: skills ? skills.join(",") : null,
          userID: user.id,
        };
        const student = await tx.student.createStudent(rawStudentData);
        return this.studentFactory.MapStudentToDTO(student);
      });
      return student;
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

  async getStudents(
    query: StudentQueryParams,
  ): Promise<PageableType<typeof StudentDTO>> {
    const [students, countStudents] = await Promise.all([
      this.studentRepository.getStudents(query),
      this.studentRepository.countStudents(query),
    ]);

    return {
      rows: students.map((student) =>
        this.studentFactory.MapStudentToDTO(student),
      ),
      totalRecords: countStudents,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  async getStudentById(id: number): Promise<StudentDTO | null> {
    try {
      const student = await this.studentRepository.getStudentById(id);
      if (!student) {
        return null;
      }
      return this.studentFactory.MapStudentToDTO(student);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getStudentByUserId(userId: number): Promise<StudentDTO | null> {
    try {
      const student = await this.studentRepository.getStudentByUserId(userId);
      if (!student) {
        return null;
      }
      return this.studentFactory.MapStudentToDTO(student);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async deleteStudent(id: number): Promise<StudentDTO> {
    const existing = await this.studentRepository.getStudentById(id);
    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND_ERROR, "Student not found", 404);
    }
    const student = await this.studentRepository.deleteStudent(existing.id);
    return this.studentFactory.MapStudentToDTO(student);
  }

  async updateStudent(
    studentID: number,
    data: StudentUpdateDTO,
    actor: { userID: number; isAdmin: boolean },
  ): Promise<StudentDTO> {
    const {
      imageFile,
      studentCode,
      linkedin,
      github,
      facebook,
      instagram,
      classBookID,
      skills,
      imageFocalPointX,
      imageFocalPointY,
      ...userData
    } = data;
    const existing = await this.studentRepository.getStudentById(studentID);
    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND_ERROR, "Student not found", 404);
    }
    if (!actor.isAdmin && existing.userID !== actor.userID) {
      throw new AppError(ErrorCode.AUTHORIZATION_ERROR, "Forbidden", 403);
    }

    let storedImage: StoredImage | null = null;
    let imageContentType: string | null = null;
    try {
      if (imageFile) {
        imageContentType = await validateProfileImage(imageFile);
        storedImage = await this.storage.upload(imageFile, imageContentType);
      }

      const updateStudentData: StudentUpdatePayload = {
        studentCode,
        linkedin,
        github,
        facebook,
        instagram,
        classBookID,
        skills:
          skills === undefined
            ? undefined
            : Array.isArray(skills)
              ? skills.join(",")
              : null,
      };

      const student = await this.unitOfWork.runInTransaction(async (tx) => {
        const image = storedImage
          ? await tx.imageMedia.create({
              ...storedImage,
              fileName: imageFile!.name,
              contentType: imageContentType!,
              fileSize: imageFile!.size,
            })
          : null;
        const updatedUserData: UpdateUserModel = {
          ...userData,
          ...(image && {
            imageID: image.id,
            imageUrl: storedImage!.imageUrl,
            imageFocalPointX:
              imageFocalPointX ?? existing.user.imageFocalPointX ?? null,
            imageFocalPointY:
              imageFocalPointY ?? existing.user.imageFocalPointY ?? null,
          }),
          ...(!image && { imageFocalPointX, imageFocalPointY }),
        };
        const updated = await tx.student.updateStudent(existing.id, updateStudentData);
        const updateUser = await tx.user.updateUser(updated.userID, updatedUserData);
        updated.user = updateUser;
        return this.studentFactory.MapStudentToDTO(updated);
      });
      return student;
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

  async importStudentsFromFile(
    file: File,
    classBookID: number,
  ): Promise<void> {
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith(".csv") || file.type === "text/csv";
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isCSV && !isExcel) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Invalid file format. Only CSV and Excel are allowed.",
        400,
      );
    }

    let rawRecords: Record<string, unknown>[];
    try {
      if (isCSV) {
        const text = await file.text();
        rawRecords = parse(text, {
          bom: true,
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
        if (!sheet) {
          throw new Error("The spreadsheet has no readable worksheet.");
        }
        rawRecords = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          raw: false,
          defval: "",
        });
      }
    } catch {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "The uploaded file could not be read.",
        400,
      );
    }

    const records = rawRecords.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key.trim(),
          String(value).trim(),
        ]),
      ),
    );

    if (records.length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "File is empty or contains no valid data rows.",
        400,
      );
    }

    const validRecords: CreateStudent[] = [];
    for (const row of records) {
      const parsedRow = {
        studentCode: row.studentCode,
        linkedin: row.linkedin || undefined,
        github: row.github || undefined,
        facebook: row.facebook || undefined,
        instagram: row.instagram || undefined,
        firstNameTh: row.firstNameTh,
        lastNameTh: row.lastNameTh,
        firstNameEn: row.firstNameEn || undefined,
        lastNameEn: row.lastNameEn || undefined,
        email: row.email,
        nickName: row.nickName || undefined,
        skills: row.skills
          ? row.skills
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean)
          : undefined,
      };

      if (!Value.Check(CreateStudent, parsedRow)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid format", 400);
      }

      validRecords.push(parsedRow as CreateStudent);
    }

    await this.unitOfWork.runInTransaction(async (transaction) => {
      for (const record of validRecords) {
        const {
          linkedin,
          github,
          facebook,
          instagram,
          studentCode,
          skills,
          ...userData
        } = record;

        const rawUserData: CreateUserModel = {
          ...userData,
        };

        const user = await transaction.user.createUser(rawUserData);
        await transaction.user.assignUserRole({
          userID: user.id,
          roleID: 2,
        });

        const rawStudentData: StudentCreatePayload = {
          linkedin: linkedin || null,
          github: github || null,
          facebook: facebook || null,
          instagram: instagram || null,
          studentCode,
          classBookID,
          skills: skills ? skills.join(",") : null,
          userID: user.id,
        };

        await transaction.student.createStudent(rawStudentData);
      }
    });
  }
}
