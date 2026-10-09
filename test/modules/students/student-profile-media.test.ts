import { describe, expect, test, vi } from "vitest";
import { StudentService } from "../../../src/modules/students/student.service";
import { Student } from "../../../src/modules/students/domain/student";
import { StoredImage } from "../../../src/infrastructure/profile-image-storage";
import { IUnitOfWork } from "../../../src/core/uow/uow.interface";
import { IStudentRepository } from "../../../src/modules/students/domain/student.repository";
import { IStudentFactory } from "../../../src/modules/students/student.factory";
import { StudentFactory } from "../../../src/modules/students/student.factory";
import { UserFactory } from "../../../src/modules/users/user.factory";
import { StudentDocs } from "../../../src/modules/students/student.docs";
import { StudentUpdateDTO } from "../../../src/modules/students/domain/student";
import { Elysia } from "elysia";

describe("student update body transforms", () => {
  test("distinguishes omitted skills from an explicit empty list and nullable clears", () => {
    const body = { skills: "", facebook: "", firstNameEn: "" };

    StudentDocs.updateStudent.transform({ body: body as never });

    expect(body.skills).toEqual([]);
    expect(body.facebook).toBeNull();
    expect(body.firstNameEn).toBeNull();
  });

  test("parses the multipart empty-skills marker as an explicit clear", async () => {
    const app = new Elysia().patch(
      "/students/:id",
      ({ body }) => body,
      {
        body: StudentUpdateDTO,
        transform: StudentDocs.updateStudent.transform,
      },
    );
    const form = new FormData();
    form.append("skills", "");
    form.append("facebook", "");
    const response = await app.handle(
      new Request("http://localhost/students/9", {
        method: "PATCH",
        body: form,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      skills: [],
      facebook: null,
    });
  });
});

describe("StudentService profile media", () => {
  test("accepts a user ID for updates and returns a user-rooted profile", async () => {
    const student = {
      id: 9,
      userID: 101,
      studentCode: "S1",
      classBookID: 3,
      skills: "systems,design",
      user: {
        id: 101,
        email: "student@example.com",
        firstNameTh: "ชื่อ",
        lastNameTh: "สกุล",
        firstNameEn: null,
        lastNameEn: null,
        nickName: null,
        imageUrl: null,
        prefix: null,
        imageMedia: null,
      },
    } as Student;
    const repository = {
      getStudentById: vi.fn(async (id: number) =>
        id === 101 ? student : null,
      ),
    };
    const tx = {
      student: {
        updateStudent: vi.fn(async (_id: number, data: Partial<Student>) => ({
          ...student,
          ...Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined),
          ),
        })),
      },
      user: {
        updateUser: vi.fn(async (_id: number, data: Record<string, unknown>) => ({
          ...student.user,
          ...data,
        })),
      },
    };
    const unitOfWork = {
      runInTransaction: vi.fn(async (run: (transaction: unknown) => unknown) =>
        run(tx),
      ),
    };
    const service = new StudentService(
      repository as unknown as IStudentRepository,
      { upload: vi.fn(), delete: vi.fn() } as never,
      new StudentFactory(new UserFactory()),
      unitOfWork as unknown as IUnitOfWork,
    );

    const result = await service.updateStudent(
      101,
      { studentCode: "S2" },
      { userID: 101, isAdmin: true },
    );

    expect(repository.getStudentById).toHaveBeenCalledWith(101);
    expect(tx.student.updateStudent).toHaveBeenCalledWith(9, {
      studentCode: "S2",
      linkedin: undefined,
      github: undefined,
      facebook: undefined,
      instagram: undefined,
      classBookID: undefined,
      skills: undefined,
    });
    expect(result).toMatchObject({
      id: 101,
      student: { id: 9, studentCode: "S2", skills: ["systems", "design"] },
    });
    expect("user" in result).toBe(false);
  });

  test("checks profile ownership before upload", async () => {
    const storage = { provider: "rustfs" as const, upload: vi.fn(), delete: vi.fn() };
    const repository = {
      getStudentById: vi.fn(async () => ({ userID: 12 }) as Student),
    };
    const service = new StudentService(
      repository as unknown as IStudentRepository,
      storage,
      {} as IStudentFactory,
      {} as IUnitOfWork,
    );

    await expect(
      service.updateStudent(
        4,
        { imageFile: new File(["bad"], "image.png") },
        { userID: 13, isAdmin: false },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  test("cleans up a newly uploaded file if the database transaction fails", async () => {
    const image: StoredImage = {
      provider: "rustfs",
      bucket: "acs-media",
      fileKey: "public/profiles/new-image",
      imageUrl: "https://acs.kmutt.ac.th/media/acs-media/public/profiles/new-image",
    };
    const storage = {
      provider: "rustfs" as const,
      upload: vi.fn(async () => image),
      delete: vi.fn(async () => {}),
    };
    const failure = new Error("database failed");
    const unitOfWork = {
      runInTransaction: vi.fn(async () => {
        throw failure;
      }),
    };
    const service = new StudentService(
      {} as IStudentRepository,
      storage,
      {} as IStudentFactory,
      unitOfWork as unknown as IUnitOfWork,
    );
    const pngBytes = Uint8Array.from(
      atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),
      (byte) => byte.charCodeAt(0),
    );
    const png = new File(
      [pngBytes],
      "profile.png",
      { type: "image/png" },
    );

    await expect(
      service.createStudent(
        {
          imageFile: png,
          prefixID: null,
          email: "user@example.com",
          firstNameTh: "ชื่อ",
          lastNameTh: "สกุล",
          firstNameEn: null,
          lastNameEn: null,
          studentCode: "S1",
          classBookID: 1,
        } as never,
      ),
    ).rejects.toBe(failure);
    expect(storage.delete).toHaveBeenCalledWith("acs-media", image.fileKey);
  });
});
