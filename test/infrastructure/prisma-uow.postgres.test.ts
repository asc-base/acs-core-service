import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import { IUnitOfWork } from "../../src/core/uow/uow.interface";
import { PrismaUnitOfWorkRepository } from "../../src/infrastructure/prisma-uow.repository";
import { UserRepository } from "../../src/infrastructure/user.repository";
import { PrismaInstance } from "../../src/lib/db";
import { UserFactory } from "../../src/modules/users/user.factory";
import { UserService } from "../../src/modules/users/user.service";
import { StudentRepository } from "../../src/infrastructure/student.repository";
import { StudentFactory } from "../../src/modules/students/student.factory";
import { StudentService } from "../../src/modules/students/student.service";

const databaseUrl = process.env.TEST_DATABASE_URL;
const postgresDescribe = databaseUrl ? describe : describe.skip;

postgresDescribe("Prisma unit of work with PostgreSQL", () => {
  let pool: pg.Pool;
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (!databaseUrl) return;
    pool = new pg.Pool({ connectionString: databaseUrl });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.$connect();
    await prisma.role.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, name: "admin" },
    });
    await prisma.role.upsert({
      where: { id: 2 },
      update: {},
      create: { id: 2, name: "student" },
    });
    await prisma.role.upsert({
      where: { id: 3 },
      update: {},
      create: { id: 3, name: "professor" },
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await pool?.end();
  });

  test("commits the user, role, auth profile, and credential together", async () => {
    const email = `uow-${randomUUID()}@example.test`;
    try {
      const user = await createService(prisma, new PrismaUnitOfWorkRepository(prisma)).createSuperUser(
        createSuperUserData(email),
      );

      expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
      expect(
        await prisma.userRole.findFirst({ where: { userID: user.id, roleID: 1 } }),
      ).not.toBeNull();
      expect(await prisma.authUser.findUnique({ where: { id: user.id } })).not.toBeNull();
      expect(
        await prisma.account.findUnique({
          where: {
            providerId_accountId: {
              providerId: "credential",
              accountId: String(user.id),
            },
          },
        }),
      ).not.toBeNull();
    } finally {
      await cleanupUser(prisma, email);
    }
  });

  test.each(["role assignment", "credential write"])(
    "rolls back every database write when %s fails",
    async (failurePoint) => {
      const email = `uow-${randomUUID()}@example.test`;
      let userID: number | undefined;
      const failure = new Error(`${failurePoint} failed`);
      const unitOfWork = failAfterWrite(
        new PrismaUnitOfWorkRepository(prisma),
        failurePoint,
        (id) => (userID = id),
        failure,
      );

      try {
        await expect(
          createService(prisma, unitOfWork).createSuperUser(createSuperUserData(email)),
        ).rejects.toBe(failure);
        expect(userID).toBeDefined();
        expect(await prisma.user.findUnique({ where: { id: userID } })).toBeNull();
        expect(await prisma.authUser.findUnique({ where: { email } })).toBeNull();
        expect(
          await prisma.userRole.findFirst({ where: { userID } }),
        ).toBeNull();
        expect(
          await prisma.account.findUnique({
            where: {
              providerId_accountId: {
                providerId: "credential",
                accountId: String(userID),
              },
            },
          }),
        ).toBeNull();
      } finally {
        await cleanupUser(prisma, email);
      }
    },
  );

  test("rolls back user, professor, student, image, and auth rows together", async () => {
    const email = `uow-${randomUUID()}@example.test`;
    let userID: number | undefined;
    let imageID: number | undefined;
    let curriculumID: number | undefined;
    let classBookID: number | undefined;
    try {
      const curriculum = await prisma.curriculum.create({
        data: {
          title: "UOW rollback test",
          year: randomUUID(),
          documentURL: "",
          description: "transaction test fixture",
          thumbnailURL: "",
        },
      });
      curriculumID = curriculum.id;
      const classBook = await prisma.classBook.create({
        data: {
          classof: `uow-${randomUUID()}`,
          firstYearAcademic: "9999",
          thumbnailURL: "",
          curriculumID,
        },
      });
      classBookID = classBook.id;

      await expect(
        new PrismaUnitOfWorkRepository(prisma).runInTransaction(async (tx) => {
          const image = await tx.imageMedia.create({
            provider: "rustfs",
            bucket: "acs-media",
            fileKey: `test/${randomUUID()}`,
            imageUrl: `https://example.test/${randomUUID()}`,
          });
          imageID = image.id;
          const user = await tx.user.createUser({
            email,
            firstNameTh: "ชื่อ",
            lastNameTh: "สกุล",
            imageID: image.id,
            imageUrl: image.imageUrl,
          });
          userID = user.id;
          await tx.user.assignUserRole({ userID, roleID: 1 });
          await tx.user.assignUserRole({ userID, roleID: 2 });
          await tx.user.assignUserRole({ userID, roleID: 3 });
          await tx.professor.createProfessor({
            userID,
            phone: "0123456789",
            profRoom: "1/1",
          });
          await tx.student.createStudent({
            userID,
            classBookID: classBook.id,
            studentCode: randomUUID(),
          });
          await tx.auth.syncCredentialAccount(userID, "hashed-password");
          throw new Error("force rollback");
        }),
      ).rejects.toThrow("force rollback");

      expect(await prisma.user.findUnique({ where: { id: userID } })).toBeNull();
      expect(await prisma.authUser.findUnique({ where: { email } })).toBeNull();
      expect(await prisma.userRole.count({ where: { userID } })).toBe(0);
      expect(await prisma.professor.count({ where: { userID } })).toBe(0);
      expect(await prisma.student.count({ where: { userID } })).toBe(0);
      expect(await prisma.imageMedia.findUnique({ where: { id: imageID } })).toBeNull();
      expect(
        await prisma.account.count({
          where: { providerId: "credential", accountId: String(userID) },
        }),
      ).toBe(0);
    } finally {
      if (userID) {
        await prisma.$transaction(async (tx) => {
          await tx.student.deleteMany({ where: { userID } });
          await tx.professor.deleteMany({ where: { userID } });
          await tx.userRole.deleteMany({ where: { userID } });
          await tx.user.deleteMany({ where: { id: userID } });
          if (imageID) await tx.imageMedia.deleteMany({ where: { id: imageID } });
        });
      }
      if (classBookID) {
        await prisma.classBook.deleteMany({ where: { id: classBookID } });
      }
      if (curriculumID) {
        await prisma.curriculum.deleteMany({ where: { id: curriculumID } });
      }
    }
  });

  test("rolls back the whole student import when a later row fails", async () => {
    const email = `uow-${randomUUID()}@example.test`;
    const studentCode = `uow-${randomUUID()}`;
    let curriculumID: number | undefined;
    let classBookID: number | undefined;
    try {
      const curriculum = await prisma.curriculum.create({
        data: {
          title: "UOW import test",
          year: randomUUID(),
          documentURL: "",
          description: "transaction test fixture",
          thumbnailURL: "",
        },
      });
      curriculumID = curriculum.id;
      const classBook = await prisma.classBook.create({
        data: {
          classof: `uow-${randomUUID()}`,
          firstYearAcademic: "9999",
          thumbnailURL: "",
          curriculumID,
        },
      });
      classBookID = classBook.id;

      const service = new StudentService(
        new StudentRepository(prisma as unknown as PrismaInstance),
        { provider: "rustfs", upload: async () => { throw new Error("unused"); }, delete: async () => {} } as never,
        new StudentFactory(new UserFactory()),
        new PrismaUnitOfWorkRepository(prisma),
      );
      const file = new File(
        [
          `studentCode,firstNameTh,lastNameTh,email\n${studentCode}-1,ชื่อ,สกุล,${email}\n${studentCode}-2,ชื่อสอง,สกุลสอง,${email}`,
        ],
        "students.csv",
        { type: "text/csv" },
      );

      await expect(
        service.importStudentsFromFile(file, classBookID),
      ).rejects.toMatchObject({ message: "A user with this email already exists" });
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      expect(await prisma.authUser.findUnique({ where: { email } })).toBeNull();
      expect(
        await prisma.student.count({ where: { studentCode: `${studentCode}-1` } }),
      ).toBe(0);
    } finally {
      await cleanupUser(prisma, email);
      if (classBookID) {
        await prisma.classBook.deleteMany({ where: { id: classBookID } });
      }
      if (curriculumID) {
        await prisma.curriculum.deleteMany({ where: { id: curriculumID } });
      }
    }
  });
});

const createService = (prisma: PrismaClient, unitOfWork: IUnitOfWork) =>
  new UserService(
    new UserRepository(prisma as unknown as PrismaInstance),
    new UserFactory(),
    unitOfWork,
  );

const createSuperUserData = (email: string) => ({
  firstNameTh: "ผู้ดูแล",
  lastNameTh: "ระบบ",
  firstNameEn: "System",
  lastNameEn: "Administrator",
  email,
  nickName: "admin",
  password: "P@ssw0rd",
});

const cleanupUser = async (prisma: PrismaClient, email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  await prisma.$transaction(async (tx) => {
    await tx.student.deleteMany({ where: { userID: user.id } });
    await tx.professor.deleteMany({ where: { userID: user.id } });
    await tx.userRole.deleteMany({ where: { userID: user.id } });
    await tx.user.delete({ where: { id: user.id } });
    if (user.imageID) await tx.imageMedia.deleteMany({ where: { id: user.imageID } });
  });
};

const failAfterWrite = (
  unitOfWork: PrismaUnitOfWorkRepository,
  failurePoint: string,
  captureUserID: (id: number) => void,
  failure: Error,
): IUnitOfWork =>
  ({
    runInTransaction: <T>(fn: (uow: IUnitOfWork) => Promise<T>) =>
      unitOfWork.runInTransaction(async (tx) => {
        const wrapped = Object.create(tx) as IUnitOfWork;
        Object.defineProperties(wrapped, {
          user: {
            value: new Proxy(tx.user, {
              get(target, property) {
                if (property === "createUser") {
                  return async (...args: Parameters<typeof target.createUser>) => {
                    const user = await target.createUser(...args);
                    captureUserID(user.id);
                    return user;
                  };
                }
                if (property === "assignUserRole" && failurePoint === "role assignment") {
                  return async (...args: Parameters<typeof target.assignUserRole>) => {
                    await target.assignUserRole(...args);
                    throw failure;
                  };
                }
                const value = Reflect.get(target, property, target);
                return typeof value === "function" ? value.bind(target) : value;
              },
            }),
          },
          auth: {
            value: new Proxy(tx.auth, {
              get(target, property) {
                if (property === "syncCredentialAccount" && failurePoint === "credential write") {
                  return async (...args: Parameters<typeof target.syncCredentialAccount>) => {
                    await target.syncCredentialAccount(...args);
                    throw failure;
                  };
                }
                const value = Reflect.get(target, property, target);
                return typeof value === "function" ? value.bind(target) : value;
              },
            }),
          },
        });
        return fn(wrapped);
      }),
  }) as IUnitOfWork;
