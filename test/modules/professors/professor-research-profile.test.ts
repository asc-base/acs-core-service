import { describe, expect, test, vi } from "vitest";
import { IUnitOfWork } from "../../../src/core/uow/uow.interface";
import { IProfessorRepository } from "../../../src/modules/professors/domain/professor.repository";
import { IUserRepository } from "../../../src/modules/users/domain/user.repository";
import { IProfessorFactory } from "../../../src/modules/professors/profressor.factory";
import { ProfessorFactory } from "../../../src/modules/professors/profressor.factory";
import { ProfileImageStorage } from "../../../src/infrastructure/profile-image-storage";
import { ProfessorService, normalizeResearchProfileURL } from "../../../src/modules/professors/professor.service";

const createService = (options: { existingProfessor?: { id: number; userID: number } | null } = {}) => {
  const tx = {
    imageMedia: { create: vi.fn() },
    user: {
      createUser: vi.fn(async () => ({ id: 5 })),
      assignUserRole: vi.fn(),
      updateUser: vi.fn(async (id: number) => ({ id })),
    },
    professor: {
      createProfessor: vi.fn(async (data: Record<string, unknown>) => ({ id: 7, userID: 5, ...data })),
      updateProfessor: vi.fn(async (id: number, data: Record<string, unknown>) => ({ id, userID: 5, ...data })),
    },
  };
  const service = new ProfessorService(
    {
      getProfessorByUserId: vi.fn(async () => options.existingProfessor ?? null),
      getProfessorById: vi.fn(async () => options.existingProfessor ?? null),
    } as unknown as IProfessorRepository,
    {
      getUserByEmail: vi.fn(async () => options.existingProfessor ? { id: 5, userRoles: [{ roleID: 3 }] } : null),
    } as unknown as IUserRepository,
    {
      mapProfessorToDTO: vi.fn((professor) => professor),
    } as unknown as IProfessorFactory,
    {
      provider: "rustfs",
      upload: vi.fn(),
      delete: vi.fn(),
    } as unknown as ProfileImageStorage,
    {
      runInTransaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(tx)),
    } as unknown as IUnitOfWork,
  );
  return { service, tx };
};

describe("professor research profile", () => {
  test("trims valid HTTP URLs, treats blanks as empty, and rejects other schemes", () => {
    expect(normalizeResearchProfileURL("  https://example.edu/research  ")).toBe(
      "https://example.edu/research",
    );
    expect(normalizeResearchProfileURL(" ")).toBeNull();
    expect(normalizeResearchProfileURL(null)).toBeNull();
    expect(normalizeResearchProfileURL(undefined)).toBeUndefined();
    expect(() => normalizeResearchProfileURL("ftp://example.edu/profile")).toThrow(
      "Research profile must be a full HTTP or HTTPS URL",
    );
    expect(() => normalizeResearchProfileURL("https:example.edu/profile")).toThrow();
    expect(() => normalizeResearchProfileURL("example.edu/profile")).toThrow();
  });

  test("includes the nullable URL in professor API responses", () => {
    const factory = new ProfessorFactory({
      mapUserToDTO: vi.fn((user) => user),
    } as never);
    const result = factory.mapProfessorToDTO({
      id: 7,
      userID: 5,
      profRoom: "1/1",
      phone: "0123456789",
      expertFields: null,
      educations: null,
      researchProfile: "https://example.edu/research",
      user: { prefix: null },
    } as never);

    expect(result.research_profile).toBe("https://example.edu/research");
  });

  test("creates professors with a URL or null when omitted", async () => {
    const withURL = createService();
    await withURL.service.createProfessor({
      firstNameTh: "ชื่อ",
      lastNameTh: "สกุล",
      email: "user@example.com",
      prefixID: 1,
      phone: "0123456789",
      profRoom: "1/1",
      research_profile: " https://example.edu/research ",
    } as never);
    expect(withURL.tx.professor.createProfessor).toHaveBeenCalledWith(
      expect.objectContaining({
        researchProfile: "https://example.edu/research",
        userID: 5,
      }),
    );

    const withoutURL = createService();
    await withoutURL.service.createProfessor({
      firstNameTh: "ชื่อ",
      lastNameTh: "สกุล",
      email: "user@example.com",
      prefixID: 1,
      phone: "0123456789",
      profRoom: "1/1",
    } as never);
    expect(withoutURL.tx.professor.createProfessor).toHaveBeenCalledWith(
      expect.objectContaining({ researchProfile: null }),
    );
  });

  test("updates, clears, or preserves the URL depending on whether it is sent", async () => {
    const existingProfessor = { id: 7, userID: 5 };
    const update = createService({ existingProfessor });
    await update.service.updateProfessor(7, { research_profile: "https://new.example.edu" });
    expect(update.tx.professor.updateProfessor).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ researchProfile: "https://new.example.edu" }),
    );

    const clear = createService({ existingProfessor });
    await clear.service.updateProfessor(7, { research_profile: "" });
    expect(clear.tx.professor.updateProfessor).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ researchProfile: null }),
    );

    const preserve = createService({ existingProfessor });
    await preserve.service.updateProfessor(7, {});
    const updatePayload = preserve.tx.professor.updateProfessor.mock.calls[0][1];
    expect(updatePayload).not.toHaveProperty("researchProfile");
  });
});
