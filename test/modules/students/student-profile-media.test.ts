import { describe, expect, test, vi } from "vitest";
import { StudentService } from "../../../src/modules/students/student.service";
import { Student } from "../../../src/modules/students/domain/student";
import { StoredImage } from "../../../src/infrastructure/profile-image-storage";
import { IUnitOfWork } from "../../../src/core/uow/uow.interface";
import { IStudentRepository } from "../../../src/modules/students/domain/student.repository";
import { IStudentFactory } from "../../../src/modules/students/student.factory";

describe("StudentService profile media", () => {
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
