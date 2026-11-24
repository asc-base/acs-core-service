import { describe, expect, test, vi } from "vitest";
import { ClassBookService } from "../../../src/modules/class-book/class-book.service";
import { ClassBookFactory } from "../../../src/modules/class-book/class-book.factory";
import { CurriculumFactory } from "../../../src/modules/curriculums/curriculum.factory";
import { IUnitOfWork } from "../../../src/core/uow/uow.interface";
import { AppError } from "../../../src/core/error/app-error";
import { ErrorCode } from "../../../src/core/types/errors";

const classBook = {
  id: 7,
  classof: "7",
  firstYearAcademic: "2569",
  thumbnailURL: "",
  curriculumID: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: new Date(),
  curriculum: { id: 1, title: "t", year: "y", documentURL: "", thumbnailURL: "", description: "", createdAt: new Date(), updatedAt: new Date(), deletedAt: null },
};

function setup(deleteClassBook: () => Promise<unknown>) {
  const calls: string[] = [];
  const tx = {
    classBook: {
      deleteClassBook: vi.fn(async () => {
        calls.push("classBook");
        return deleteClassBook();
      }),
    },
    student: {
      deleteStudentsByClassBookID: vi.fn(async () => {
        calls.push("students");
      }),
    },
  };
  const unitOfWork = {
    runInTransaction: vi.fn(async (fn: (uow: unknown) => Promise<unknown>) => fn(tx)),
  } as unknown as IUnitOfWork;
  const service = new ClassBookService(
    {} as never,
    new ClassBookFactory(new CurriculumFactory()),
    {} as never,
    unitOfWork,
  );
  return { service, tx, unitOfWork, calls };
}

describe("ClassBookService.deleteClassBook", () => {
  test("deletes the class book and its students in one unit of work", async () => {
    const { service, tx, unitOfWork, calls } = setup(async () => classBook);

    await service.deleteClassBook(7);

    expect(unitOfWork.runInTransaction).toHaveBeenCalledOnce();
    expect(tx.classBook.deleteClassBook).toHaveBeenCalledWith(7);
    expect(tx.student.deleteStudentsByClassBookID).toHaveBeenCalledWith(7);
    expect(calls).toEqual(["classBook", "students"]);
  });

  test("does not touch students when the class book is not found", async () => {
    const notFound = new AppError(ErrorCode.NOT_FOUND_ERROR, "ClassBook not found", 404);
    const { service, tx } = setup(async () => {
      throw notFound;
    });

    await expect(service.deleteClassBook(7)).rejects.toBe(notFound);
    expect(tx.student.deleteStudentsByClassBookID).not.toHaveBeenCalled();
  });
});
