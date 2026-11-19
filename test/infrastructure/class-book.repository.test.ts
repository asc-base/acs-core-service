import { describe, expect, test, vi } from "vitest";
import { Prisma } from "../../src/generated/prisma/client";
import { ClassBookRepository } from "../../src/infrastructure/class-book.repository";
import { StudentRepository } from "../../src/infrastructure/student.repository";

const createTx = () => ({
  student: {
    findMany: vi.fn(async () => [{ userID: 11 }, { userID: 12 }]),
    updateMany: vi.fn(async (_args: unknown) => ({ count: 2 })),
  },
  user: {
    findMany: vi.fn(async (_args: unknown) => [] as { id: number }[]),
    updateMany: vi.fn(async (_args: unknown) => ({ count: 2 })),
  },
  authUser: { deleteMany: vi.fn(async () => ({ count: 2 })) },
  classBook: { update: vi.fn(async (_args: unknown) => ({ id: 5 })) },
});

const createDb = (tx: ReturnType<typeof createTx>) => {
  const $transaction = vi.fn(async (run: (client: unknown) => unknown) => run(tx));
  return { $transaction } as never;
};

describe("ClassBookRepository.deleteClassBook", () => {
  test("soft-deletes the class, its students and their users in one transaction", async () => {
    const tx = createTx();
    const db = createDb(tx);

    await new ClassBookRepository(db).deleteClassBook(5);

    expect((db as { $transaction: unknown }).$transaction).toHaveBeenCalledOnce();
    expect(tx.student.findMany).toHaveBeenCalledWith({
      where: { classBookID: 5, deletedAt: null },
      select: { userID: true },
    });
    const studentUpdate = tx.student.updateMany.mock.calls[0]?.[0] as {
      where: unknown;
      data: { deletedAt: Date };
    };
    expect(studentUpdate.where).toEqual({ classBookID: 5, deletedAt: null });
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [11, 12] }, deletedAt: null },
      data: { deletedAt: studentUpdate.data.deletedAt },
    });
    expect(tx.authUser.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [11, 12] } },
    });
    const classUpdate = tx.classBook.update.mock.calls[0]?.[0] as {
      data: { deletedAt: Date };
    };
    expect(classUpdate.data.deletedAt).toBe(studentUpdate.data.deletedAt);
  });

  test("does not touch users or auth when the class has no active students", async () => {
    const tx = createTx();
    tx.student.findMany.mockResolvedValueOnce([]);

    await new ClassBookRepository(createDb(tx)).deleteClassBook(5);

    expect(tx.user.updateMany).not.toHaveBeenCalled();
    expect(tx.authUser.deleteMany).not.toHaveBeenCalled();
    expect(tx.classBook.update).toHaveBeenCalledOnce();
  });

  test("keeps a user who still has another active profile (e.g. professor)", async () => {
    const tx = createTx();
    tx.user.findMany.mockResolvedValueOnce([{ id: 12 }]);

    await new ClassBookRepository(createDb(tx)).deleteClassBook(5);

    expect(tx.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [11] }, deletedAt: null } }),
    );
    expect(tx.authUser.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [11] } },
    });
  });

  test("propagates a failure so the surrounding transaction rolls back", async () => {
    const tx = createTx();
    const failure = new Error("boom");
    tx.classBook.update.mockRejectedValueOnce(failure);

    await expect(
      new ClassBookRepository(createDb(tx)).deleteClassBook(5),
    ).rejects.toBe(failure);
  });

  test("maps a missing class (P2025) to 404", async () => {
    const tx = createTx();
    tx.classBook.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("missing", {
        code: "P2025",
        clientVersion: "test",
      }),
    );

    await expect(
      new ClassBookRepository(createDb(tx)).deleteClassBook(5),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("StudentRepository.deleteStudent", () => {
  test("soft-deletes the student and releases the user's email together", async () => {
    const tx = {
      student: { update: vi.fn(async () => ({ id: 3, userID: 21 })) },
      user: {
        findMany: vi.fn(async () => []),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      authUser: { deleteMany: vi.fn(async () => ({ count: 1 })) },
    };
    const db = {
      $transaction: vi.fn(async (run: (client: unknown) => unknown) => run(tx)),
    } as never;

    await new StudentRepository(db).deleteStudent(3);

    expect(tx.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [21] }, deletedAt: null } }),
    );
    expect(tx.authUser.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [21] } },
    });
  });
});
