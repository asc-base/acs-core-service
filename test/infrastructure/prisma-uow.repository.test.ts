import { describe, expect, test, vi } from "vitest";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaUnitOfWorkRepository } from "../../src/infrastructure/prisma-uow.repository";

describe("PrismaUnitOfWorkRepository", () => {
  test("builds every repository from the transaction client and propagates failure", async () => {
    const failure = new Error("transaction failed");
    const transaction = {
      user: { create: vi.fn(async () => ({ id: 1 })) },
      userRole: { create: vi.fn(async () => ({})) },
      professor: { create: vi.fn(async () => ({})) },
      student: { create: vi.fn(async () => ({})) },
      imageMedia: { create: vi.fn(async () => ({})) },
      account: { upsert: vi.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const unitOfWork = new PrismaUnitOfWorkRepository(prisma);

    await expect(
      unitOfWork.runInTransaction(async (tx) => {
        const user = await tx.user.createUser({
          email: "uow@example.test",
          firstNameTh: "ชื่อ",
          lastNameTh: "สกุล",
        });
        await tx.user.assignUserRole({ userID: user.id, roleID: 1 });
        await tx.professor.createProfessor({
          userID: user.id,
          phone: "0123456789",
          profRoom: "1/1",
        });
        await tx.student.createStudent({
          userID: user.id,
          classBookID: 1,
          studentCode: "S1",
        });
        await tx.imageMedia.create({
          provider: "rustfs",
          imageUrl: "https://example.test/image",
        });
        await tx.auth.syncCredentialAccount(user.id, "hashed-password");
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transaction.user.create).toHaveBeenCalledOnce();
    expect(transaction.userRole.create).toHaveBeenCalledOnce();
    expect(transaction.professor.create).toHaveBeenCalledOnce();
    expect(transaction.student.create).toHaveBeenCalledOnce();
    expect(transaction.imageMedia.create).toHaveBeenCalledOnce();
    expect(transaction.account.upsert).toHaveBeenCalledOnce();
  });
});
