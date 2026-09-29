import { SupabaseService } from "../../core/utils/supabase";
import {
  CreateStudentDTO,
  StudentDTO,
  Student,
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
import { IUserRepository } from "../users/domain/user.repository";
import { CreateUserModel, UpdateUserModel } from "../users/domain/user";
import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";
import { IStudentFactory } from "./student.factory";
import { PageableType } from "../../core/models";
import { IUnitOfWork } from "../../core/uow/uow.interface";

interface IStudentService {
  createStudent(data: CreateStudentDTO): Promise<StudentDTO>;
  getStudents(
    query: StudentQueryParams,
  ): Promise<PageableType<typeof StudentDTO>>;
  getStudentById(id: number): Promise<StudentDTO | null>;
  deleteStudent(id: number): Promise<StudentDTO>;
  updateStudent(studentID: number, data: StudentUpdateDTO): Promise<StudentDTO>;
  importStudentsFromFile(
    file: File,
    classBookID: number,
  ): Promise<void>;
}

export class StudentService implements IStudentService {
  constructor(
    private readonly studentRepository: IStudentRepository,
    private readonly userRepository: IUserRepository,
    private readonly storage: SupabaseService,
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
    let imagePath: string | null = null;
    try {
      if (imageFile) {
        imagePath = await this.storage.uploadFile(imageFile, "students");
      }

      const rawUserData: CreateUserModel = {
        prefixID,
        email,
        firstNameTh,
        lastNameTh,
        nickName,
        firstNameEn,
        lastNameEn,
        imageUrl: imagePath,
        imageFocalPointX: imageFocalPointX,
        imageFocalPointY: imageFocalPointY,
      };

      const user = await this.userRepository.createUser(rawUserData);

      if (!user) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          "Failed to create user for student",
        );
      }

      const role = await this.userRepository.assignUserRole({
        userID: user.id,
        roleID: 2,
      });

      if (!role) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          "Failed to assign role to student user",
        );
      }

      const rawStudentData: StudentCreatePayload = {
        ...studentData,
        skills: skills ? skills.join(",") : null,
        userID: user.id,
      };

      const student =
        await this.studentRepository.createStudent(rawStudentData);

      if (!student) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          "Failed to create student",
        );
      }

      return this.studentFactory.MapStudentToDTO(student);
    } catch (error) {
      console.log(error);
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
    const student = await this.studentRepository.deleteStudent(id);
    return this.studentFactory.MapStudentToDTO(student);
  }

  async updateStudent(
    studentID: number,
    data: StudentUpdateDTO,
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
    let imagePath: string | undefined = undefined;
    let student: Student;
    try {
      if (imageFile) {
        imagePath = await this.storage.uploadFile(imageFile, "students");
      }

      const updatedUserData: UpdateUserModel = {
        ...(imagePath && { imageUrl: imagePath }),
        ...userData,
        imageFocalPointX: imageFocalPointX,
        imageFocalPointY: imageFocalPointY,
      };

      const updateStudentData: StudentUpdatePayload = {
        studentCode,
        linkedin,
        github,
        facebook,
        instagram,
        classBookID,
        skills: skills ? skills.join(",") : null,
      };

      student = await this.studentRepository.updateStudent(
        studentID,
        updateStudentData,
      );

      const updateUser = await this.userRepository.updateUser(
        student.userID,
        updatedUserData,
      );

      if (!updateUser) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          "Failed to update user for student",
        );
      }

      student.user = updateUser;

      return this.studentFactory.MapStudentToDTO(student);
    } catch (error) {
      console.log(error);
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
