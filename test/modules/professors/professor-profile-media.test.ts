import { describe, expect, test, vi } from "vitest";
import { ProfessorService } from "../../../src/modules/professors/professor.service";
import { IUnitOfWork } from "../../../src/core/uow/uow.interface";
import { IProfessorRepository } from "../../../src/modules/professors/domain/professor.repository";
import { IUserRepository } from "../../../src/modules/users/domain/user.repository";
import { IProfessorFactory } from "../../../src/modules/professors/profressor.factory";
import { Professor } from "../../../src/modules/professors/domain/professor";
import { ProfileImageStorage } from "../../../src/infrastructure/profile-image-storage";

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
      mapProfessorToDTO: vi.fn((professor: Professor) => professor),
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
    expect(result).toMatchObject({ id: existingProfessor.id, userID: existingUser.id });
  });
});
