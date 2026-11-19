import { describe, expect, it, vi, beforeEach } from "vitest";
import { StudentService } from "../../../src/modules/students/student.service";
import { IStudentRepository } from "../../../src/modules/students/domain/student.repository";
import { IUserRepository } from "../../../src/modules/users/domain/user.repository";
import { StudentFactory } from "../../../src/modules/students/student.factory";
import { UserFactory } from "../../../src/modules/users/user.factory";
import { IUnitOfWork } from "../../../src/core/uow/uow.interface";
import { AppError } from "../../../src/core/error/app-error";
import { ErrorCode } from "../../../src/core/types/errors";
import { HttpStatusCode } from "../../../src/core/types/http";
import { Student } from "../../../src/modules/students/domain/student";

describe("StudentService", () => {
  let studentRepository: {
    getStudentById: ReturnType<typeof vi.fn>;
    getStudentByUserId: ReturnType<typeof vi.fn>;
    getStudents: ReturnType<typeof vi.fn>;
    countStudents: ReturnType<typeof vi.fn>;
    deleteStudent: ReturnType<typeof vi.fn>;
    updateStudent: ReturnType<typeof vi.fn>;
    createStudent: ReturnType<typeof vi.fn>;
  };
  let userRepository: {
    getUserByEmail: ReturnType<typeof vi.fn>;
  };
  let storage: {
    upload: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let txStudent: {
    getStudentByUserId: ReturnType<typeof vi.fn>;
    updateStudent: ReturnType<typeof vi.fn>;
    createStudent: ReturnType<typeof vi.fn>;
  };
  let txUser: {
    getUserByEmail: ReturnType<typeof vi.fn>;
    updateUser: ReturnType<typeof vi.fn>;
    createUser: ReturnType<typeof vi.fn>;
    assignUserRole: ReturnType<typeof vi.fn>;
  };
  let txImageMedia: {
    create: ReturnType<typeof vi.fn>;
  };
  let unitOfWork: IUnitOfWork;
  let service: StudentService;

  const mockUser = {
    id: 1,
    email: "student@test.com",
    firstNameTh: "สมชาย",
    lastNameTh: "ใจดี",
    firstNameEn: "Somchai",
    lastNameEn: "Jaidee",
    nickName: "ชาย",
    imageUrl: null,
    prefixID: 1,
    userRoles: [{ roleID: 2 }],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockActiveStudent: Student = {
    id: 10,
    userID: 1,
    studentCode: "6501001",
    classBookID: 1,
    skills: "typescript,nodejs",
    linkedin: null,
    github: null,
    facebook: null,
    instagram: null,
    user: mockUser,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as unknown as Student;

  const mockSoftDeletedStudent: Student = {
    ...mockActiveStudent,
    deletedAt: new Date("2026-01-01"),
  } as unknown as Student;

  beforeEach(() => {
    studentRepository = {
      getStudentById: vi.fn(),
      getStudentByUserId: vi.fn(),
      getStudents: vi.fn(),
      countStudents: vi.fn(),
      deleteStudent: vi.fn(),
      updateStudent: vi.fn(),
      createStudent: vi.fn(),
    };
    userRepository = {
      getUserByEmail: vi.fn(),
    };
    storage = {
      upload: vi.fn(),
      delete: vi.fn(),
    };
    txStudent = {
      getStudentByUserId: vi.fn(),
      updateStudent: vi.fn(),
      createStudent: vi.fn(),
    };
    txUser = {
      getUserByEmail: vi.fn(),
      updateUser: vi.fn(),
      createUser: vi.fn(),
      assignUserRole: vi.fn(),
    };
    txImageMedia = {
      create: vi.fn(),
    };

    unitOfWork = {
      runInTransaction: vi.fn(async (cb) => {
        return cb({
          student: txStudent,
          user: txUser,
          imageMedia: txImageMedia,
        });
      }),
    } as unknown as IUnitOfWork;

    service = new StudentService(
      studentRepository as unknown as IStudentRepository,
      userRepository as unknown as IUserRepository,
      storage as never,
      new StudentFactory(new UserFactory()),
      unitOfWork,
    );
  });

  describe("createStudent", () => {
    const studentPayload = {
      studentCode: "6501001",
      email: "student@test.com",
      firstNameTh: "สมชาย",
      lastNameTh: "ใจดี",
      firstNameEn: "Somchai",
      lastNameEn: "Jaidee",
      nickName: "ชาย",
      prefixID: 1,
      classBookID: 1,
      skills: ["typescript", "nodejs"],
    };

    it("throws 409 DUPLICATE_DATA_ERROR if an active student with this email already exists", async () => {
      userRepository.getUserByEmail.mockResolvedValue(mockUser);
      studentRepository.getStudentByUserId.mockResolvedValue(mockActiveStudent);

      await expect(service.createStudent(studentPayload)).rejects.toThrowError(
        new AppError(
          ErrorCode.DUPLICATE_DATA_ERROR,
          "A student with this email already exists",
          HttpStatusCode.CONFICLT_ERROR,
        ),
      );
    });

    it("throws 409 DUPLICATE_DATA_ERROR if user exists with another role (not a student)", async () => {
      userRepository.getUserByEmail.mockResolvedValue(mockUser);
      studentRepository.getStudentByUserId.mockResolvedValue(null);

      txUser.getUserByEmail.mockResolvedValue(mockUser);
      txStudent.getStudentByUserId.mockResolvedValue(null);

      await expect(service.createStudent(studentPayload)).rejects.toThrowError(
        new AppError(
          ErrorCode.DUPLICATE_DATA_ERROR,
          "A user with this email already exists",
          HttpStatusCode.CONFICLT_ERROR,
        ),
      );
    });

    it("restores soft-deleted student by setting deletedAt to null and updating records", async () => {
      userRepository.getUserByEmail.mockResolvedValue(mockUser);
      studentRepository.getStudentByUserId.mockResolvedValue(mockSoftDeletedStudent);

      txUser.getUserByEmail.mockResolvedValue(mockUser);
      txStudent.getStudentByUserId.mockResolvedValue(mockSoftDeletedStudent);
      txUser.updateUser.mockResolvedValue(mockUser);

      const restoredStudent: Student = {
        ...mockActiveStudent,
        user: mockUser,
      };
      txStudent.updateStudent.mockResolvedValue(restoredStudent);

      const result = await service.createStudent(studentPayload);

      expect(txUser.updateUser).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          firstNameTh: "สมชาย",
          lastNameTh: "ใจดี",
        }),
      );
      expect(txStudent.updateStudent).toHaveBeenCalledWith(
        mockSoftDeletedStudent.id,
        expect.objectContaining({
          deletedAt: null,
          studentCode: "6501001",
        }),
      );
      expect(result.student.id).toBe(restoredStudent.id);
      expect(result.id).toBe(mockUser.id);
    });

    it("creates brand new user and student when no existing record found", async () => {
      userRepository.getUserByEmail.mockResolvedValue(null);
      studentRepository.getStudentByUserId.mockResolvedValue(null);

      txUser.getUserByEmail.mockResolvedValue(null);
      txStudent.getStudentByUserId.mockResolvedValue(null);

      const newUser = { ...mockUser, id: 99 };
      txUser.createUser.mockResolvedValue(newUser);
      txUser.assignUserRole.mockResolvedValue(undefined);

      const newStudent: Student = {
        ...mockActiveStudent,
        id: 199,
        userID: 99,
        user: newUser,
      };
      txStudent.createStudent.mockResolvedValue(newStudent);

      const result = await service.createStudent(studentPayload);

      expect(txUser.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: studentPayload.email }),
      );
      expect(txUser.assignUserRole).toHaveBeenCalledWith({
        userID: 99,
        roleID: 2,
      });
      expect(txStudent.createStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          userID: 99,
          studentCode: studentPayload.studentCode,
        }),
      );
      expect(result.student.id).toBe(199);
      expect(result.id).toBe(99);
    });
  });

  describe("importStudentsFromFile", () => {
    const csvContent =
      "studentCode,firstNameTh,lastNameTh,email\n6501001,สมชาย,ใจดี,somchai@test.com";
    const createCsvFile = () =>
      new File([csvContent], "students.csv", { type: "text/csv" });

    it("throws 409 DUPLICATE_DATA_ERROR if a student in the file is already active", async () => {
      txUser.getUserByEmail.mockResolvedValue(mockUser);
      txStudent.getStudentByUserId.mockResolvedValue(mockActiveStudent);

      await expect(
        service.importStudentsFromFile(createCsvFile(), 1),
      ).rejects.toThrowError(
        new AppError(
          ErrorCode.DUPLICATE_DATA_ERROR,
          "A student with email somchai@test.com already exists",
          HttpStatusCode.CONFICLT_ERROR,
        ),
      );
    });

    it("throws 409 DUPLICATE_DATA_ERROR if a user exists with another role (not a student)", async () => {
      txUser.getUserByEmail.mockResolvedValue(mockUser);
      txStudent.getStudentByUserId.mockResolvedValue(null);

      await expect(
        service.importStudentsFromFile(createCsvFile(), 1),
      ).rejects.toThrowError(
        new AppError(
          ErrorCode.DUPLICATE_DATA_ERROR,
          "A user with email somchai@test.com already exists",
          HttpStatusCode.CONFICLT_ERROR,
        ),
      );
    });

    it("successfully restores soft-deleted student during file import", async () => {
      txUser.getUserByEmail.mockResolvedValue(mockUser);
      txStudent.getStudentByUserId.mockResolvedValue(mockSoftDeletedStudent);
      txUser.updateUser.mockResolvedValue(mockUser);
      txStudent.updateStudent.mockResolvedValue({
        ...mockActiveStudent,
        deletedAt: null,
      });

      await expect(
        service.importStudentsFromFile(createCsvFile(), 1),
      ).resolves.toBeUndefined();

      expect(txUser.updateUser).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          firstNameTh: "สมชาย",
          lastNameTh: "ใจดี",
        }),
      );
      expect(txStudent.updateStudent).toHaveBeenCalledWith(
        mockSoftDeletedStudent.id,
        expect.objectContaining({
          deletedAt: null,
          studentCode: "6501001",
        }),
      );
    });

    it("successfully imports brand new student from file", async () => {
      txUser.getUserByEmail.mockResolvedValue(null);
      txStudent.getStudentByUserId.mockResolvedValue(null);

      const newUser = { ...mockUser, id: 88, userRoles: [] };
      txUser.createUser.mockResolvedValue(newUser);
      txUser.assignUserRole.mockResolvedValue(undefined);
      txStudent.createStudent.mockResolvedValue({
        ...mockActiveStudent,
        id: 188,
        userID: 88,
      });

      await expect(
        service.importStudentsFromFile(createCsvFile(), 1),
      ).resolves.toBeUndefined();

      expect(txUser.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: "somchai@test.com" }),
      );
      expect(txUser.assignUserRole).toHaveBeenCalledWith({
        userID: 88,
        roleID: 2,
      });
      expect(txStudent.createStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          userID: 88,
          studentCode: "6501001",
        }),
      );
    });
  });

  describe("getStudentByUserId & getStudentById", () => {
    it("returns mapped StudentDTO when student is found by userId", async () => {
      studentRepository.getStudentByUserId.mockResolvedValue(mockActiveStudent);

      const result = await service.getStudentByUserId(mockUser.id);
      expect(result).not.toBeNull();
      expect(result?.student.id).toBe(mockActiveStudent.id);
      expect(result?.id).toBe(mockUser.id);
      expect(studentRepository.getStudentByUserId).toHaveBeenCalledWith(mockUser.id);
    });

    it("returns null when student is not found by userId", async () => {
      studentRepository.getStudentByUserId.mockResolvedValue(null);

      const result = await service.getStudentByUserId(999);
      expect(result).toBeNull();
    });

    it("returns mapped StudentDTO when student is found by id", async () => {
      studentRepository.getStudentById.mockResolvedValue(mockActiveStudent);

      const result = await service.getStudentById(mockActiveStudent.id);
      expect(result).not.toBeNull();
      expect(result?.student.id).toBe(mockActiveStudent.id);
      expect(result?.id).toBe(mockUser.id);
    });

    it("returns null when student is not found by id", async () => {
      studentRepository.getStudentById.mockResolvedValue(null);

      const result = await service.getStudentById(999);
      expect(result).toBeNull();
    });
  });

  describe("deleteStudent", () => {
    it("soft deletes student when found", async () => {
      studentRepository.getStudentById.mockResolvedValue(mockActiveStudent);
      studentRepository.deleteStudent.mockResolvedValue({
        ...mockActiveStudent,
        deletedAt: new Date(),
      });

      const result = await service.deleteStudent(mockActiveStudent.id);
      expect(studentRepository.getStudentById).toHaveBeenCalledWith(mockActiveStudent.id);
      expect(studentRepository.deleteStudent).toHaveBeenCalledWith(mockActiveStudent.id);
      expect(result.student.id).toBe(mockActiveStudent.id);
      expect(result.id).toBe(mockUser.id);
    });

    it("throws 404 NOT_FOUND_ERROR if student to delete does not exist", async () => {
      studentRepository.getStudentById.mockResolvedValue(null);

      await expect(service.deleteStudent(999)).rejects.toThrowError(
        new AppError(ErrorCode.NOT_FOUND_ERROR, "Student not found", 404),
      );
      expect(studentRepository.deleteStudent).not.toHaveBeenCalled();
    });
  });
});
