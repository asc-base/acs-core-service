import { describe, expect, test, vi } from "vitest";
import { ProfessorService } from "../../../src/modules/professors/professor.service";
import { IUnitOfWork } from "../../../src/core/uow/uow.interface";
import { IProfessorRepository } from "../../../src/modules/professors/domain/professor.repository";
import { IUserRepository } from "../../../src/modules/users/domain/user.repository";
import { IProfessorFactory } from "../../../src/modules/professors/profressor.factory";
import { Professor } from "../../../src/modules/professors/domain/professor";
import { ProfileImageStorage } from "../../../src/infrastructure/profile-image-storage";
import { ProfessorFactory } from "../../../src/modules/professors/profressor.factory";
import { UserFactory } from "../../../src/modules/users/user.factory";

const pngFile = () =>
  new File(
    [
      Uint8Array.from(
        atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),
        (byte) => byte.charCodeAt(0),
      ),
    ],
    "profile.png",
    { type: "image/png" },
  );

describe("ProfessorService profile media", () => {
  test("accepts a user ID for edits and returns the user-rooted profile", async () => {
    const existing: Professor = {
      id: 9,
      userID: 101,
      profRoom: "1/1",
      phone: "0123456789",
      expertFields: null,
      educations: [],
      researchProfile: null,
      user: {
        id: 101,
        email: "professor@example.com",
        firstNameTh: "ชื่อ",
        lastNameTh: "สกุล",
        firstNameEn: null,
        lastNameEn: null,
        prefix: null,
        imageUrl: null,
      },
    } as Professor;
    const repository = {
      getProfessorById: vi.fn(async (id: number) => id === 101 ? existing : null),
    };
    const tx = {
      user: {
        updateUser: vi.fn(async (_id: number, data: Record<string, unknown>) => ({
          ...existing.user,
          ...data,
        })),
      },
      professor: {
        updateProfessor: vi.fn(async (_id: number, data: Record<string, unknown>) => ({
          ...existing,
          ...data,
        })),
      },
    };
    const unitOfWork = {
      runInTransaction: vi.fn(async (run: (transaction: unknown) => unknown) =>
        run(tx),
      ),
    };
    const service = new ProfessorService(
      repository as unknown as IProfessorRepository,
      {} as IUserRepository,
      new ProfessorFactory(new UserFactory()),
      { upload: vi.fn(), delete: vi.fn() } as never,
      unitOfWork as unknown as IUnitOfWork,
    );

    const result = await service.updateProfessor(101, { profRoom: "2/2" } as never);

    expect(repository.getProfessorById).toHaveBeenCalledWith(101);
    expect(tx.professor.updateProfessor).toHaveBeenCalledWith(9, {
      profRoom: "2/2",
    });
    expect(result).toMatchObject({
      id: 101,
      professor: { id: 9, profRoom: "2/2" },
    });
    expect("user" in result!).toBe(false);
  });

  test("restores an existing professor and updates the shared user's image atomically", async () => {
    const existingUser = { id: 5, userRoles: [{ roleID: 3 }] };
    const existingProfessor = { id: 7, userID: 5, deletedAt: new Date() };
    const image = { id: 51 };
    const media = {
      provider: "rustfs" as const,
      bucket: "acs-media",
      fileKey: "public/profiles/one",
      imageUrl: "https://acs.kmutt.ac.th/media/acs-media/public/profiles/one",
    };
    const tx = {
      imageMedia: { create: vi.fn(async () => image) },
      user: {
        updateUser: vi.fn(async (id: number, data: Record<string, unknown>) => ({
          id,
          ...data,
          imageMedia: { provider: "rustfs", imageUrl: media.imageUrl },
        })),
      },
      professor: {
        updateProfessor: vi.fn(async (id: number, data: Record<string, unknown>) => ({
          id,
          userID: 5,
          ...data,
        })),
      },
    };
    const unitOfWork = {
      runInTransaction: vi.fn(async (callback: (transaction: unknown) => unknown) =>
        callback(tx),
      ),
    };
    const storage: ProfileImageStorage = {
      provider: "rustfs",
      upload: vi.fn(async () => media),
      delete: vi.fn(async () => {}),
    };
    const professorFactory = {
      mapProfessorToDTO: vi.fn((professor: Professor) => ({
        id: professor.user.id,
        professor: { id: professor.id },
      })),
      mapPrfessorListToDTO: vi.fn(),
    };
    const service = new ProfessorService(
      {
        getProfessorByUserId: vi.fn(async () => existingProfessor),
      } as unknown as IProfessorRepository,
      {
        getUserByEmail: vi.fn(async () => existingUser),
      } as unknown as IUserRepository,
      professorFactory as unknown as IProfessorFactory,
      storage,
      unitOfWork as unknown as IUnitOfWork,
    );

    const result = await service.createProfessor({
      firstNameTh: "ชื่อ",
      lastNameTh: "สกุล",
      firstNameEn: null,
      lastNameEn: null,
      email: "user@example.com",
      prefixID: null,
      phone: "0123456789",
      profRoom: "1/1",
      imageFile: pngFile(),
    } as never);

    expect(unitOfWork.runInTransaction).toHaveBeenCalledOnce();
    expect(tx.imageMedia.create).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "rustfs",
        fileKey: media.fileKey,
        contentType: "image/png",
      }),
    );
    expect(tx.user.updateUser).toHaveBeenCalledWith(
      existingUser.id,
      expect.objectContaining({
        imageID: image.id,
        imageUrl: media.imageUrl,
        imageFocalPointX: null,
        imageFocalPointY: null,
      }),
    );
    expect(tx.professor.updateProfessor).toHaveBeenCalledWith(
      existingProfessor.id,
      expect.objectContaining({ deletedAt: null }),
    );
    expect(storage.delete).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: existingUser.id,
      professor: { id: existingProfessor.id },
    });
  });
});
