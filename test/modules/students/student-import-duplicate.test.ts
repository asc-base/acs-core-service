import { describe, expect, test, vi } from "vitest";
import { StudentService } from "../../../src/modules/students/student.service";
import { StudentFactory } from "../../../src/modules/students/student.factory";
import { UserFactory } from "../../../src/modules/users/user.factory";
import { IStudentRepository } from "../../../src/modules/students/domain/student.repository";
import { IUnitOfWork } from "../../../src/core/uow/uow.interface";
import { AppError } from "../../../src/core/error/app-error";
import { ErrorCode } from "../../../src/core/types/errors";

const HEADER = "studentCode,email,firstNameTh,lastNameTh,firstNameEn,lastNameEn,nickName";

const csvFile = (...rows: string[]) =>
  new File([[HEADER, ...rows].join("\n")], "students.csv", { type: "text/csv" });

function setup(existingCodesInDb: string[] = []) {
  const tx = {
    student: {
      findExistingStudentCodes: vi.fn(async (codes: string[]) =>
        codes.filter((code) => existingCodesInDb.includes(code)),
      ),
      createStudent: vi.fn(async () => ({})),
    },
    user: {
      createUser: vi.fn(async () => ({ id: 1 })),
      assignUserRole: vi.fn(async () => ({})),
    },
  };
  const unitOfWork = {
    runInTransaction: vi.fn(async (run: (t: unknown) => unknown) => run(tx)),
  };
  const service = new StudentService(
    {} as IStudentRepository,
    { upload: vi.fn(), delete: vi.fn() } as never,
    new StudentFactory(new UserFactory()),
    unitOfWork as unknown as IUnitOfWork,
  );
  return { service, tx };
}

describe("StudentService.importStudentsFromFile duplicate studentCode", () => {
  test("rejects when a studentCode already exists in DB even if email is new", async () => {
    const { service, tx } = setup(["67090500101"]);
    const file = csvFile(
      "67090500101,brand.new@example.com,สมชาย,ใจดี,Somchai,Jaidee,ชาย",
    );

    const error = await service.importStudentsFromFile(file, 1).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.type).toBe(ErrorCode.DUPLICATE_DATA_ERROR);
    expect(error.statusCode).toBe(409);
    expect(error.message).toContain("67090500101");
    expect(tx.user.createUser).not.toHaveBeenCalled();
    expect(tx.student.createStudent).not.toHaveBeenCalled();
  });

  test("rejects the whole file when only one of many rows is a duplicate", async () => {
    const { service, tx } = setup(["67090500101"]);
    const file = csvFile(
      "67090500901,new1@example.com,หนึ่ง,ทดสอบ,,,",
      "67090500101,new2@example.com,สอง,ทดสอบ,,,",
    );

    await expect(service.importStudentsFromFile(file, 1)).rejects.toBeInstanceOf(AppError);
    expect(tx.user.createUser).not.toHaveBeenCalled();
  });

  test("rejects when the same studentCode appears twice inside the file", async () => {
    const { service, tx } = setup([]);
    const file = csvFile(
      "67090500901,a@example.com,เอ,ทดสอบ,,,",
      "67090500901,b@example.com,บี,ทดสอบ,,,",
    );

    const error = await service.importStudentsFromFile(file, 1).catch((e) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(409);
    expect(tx.student.findExistingStudentCodes).not.toHaveBeenCalled();
    expect(tx.user.createUser).not.toHaveBeenCalled();
  });

  test("imports normally when every studentCode is new", async () => {
    const { service, tx } = setup(["67090500101"]);
    const file = csvFile(
      "67090500901,new1@example.com,หนึ่ง,ทดสอบ,,,",
      "67090500902,new2@example.com,สอง,ทดสอบ,,,",
    );

    await service.importStudentsFromFile(file, 1);

    expect(tx.student.findExistingStudentCodes).toHaveBeenCalledWith([
      "67090500901",
      "67090500902",
    ]);
    expect(tx.user.createUser).toHaveBeenCalledTimes(2);
    expect(tx.student.createStudent).toHaveBeenCalledTimes(2);
  });
});
