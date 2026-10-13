import { describe, expect, test, vi } from "vitest";
import { ProjectRepository } from "../../../src/infrastructure/project.repository";
import type { PrismaInstance } from "../../../src/lib/db";

describe("ProjectRepository filters and relation writes", () => {
  test("rejects duplicate users across project member types", async () => {
    const tx = {
      imageMedia: { upsert: vi.fn().mockResolvedValue({ id: 10 }) },
      project: { create: vi.fn().mockResolvedValue({ id: 7 }) },
      projectMember: { createMany: vi.fn() },
      user: { findMany: vi.fn() },
    };
    const db = { $transaction: (callback: (transaction: unknown) => unknown) => callback(tx) } as unknown as PrismaInstance;
    const repository = new ProjectRepository(db);

    await expect(repository.createProject({
      title: "Project",
      detail: "Details",
      githubURL: "github",
      presentationURL: "presentation",
      documentURL: "document",
      youtubeURL: "youtube",
      courseIds: [],
      members: [
        { userID: 8, memberType: "STUDENT" },
        { userID: 8, memberType: "ADVISOR" },
      ],
      techStacks: [],
      thumbnailMedia: { provider: "legacy_url", imageUrl: "https://example.test/cover.png" },
      galleryImages: [],
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(tx.user.findMany).not.toHaveBeenCalled();
    expect(tx.projectMember.createMany).not.toHaveBeenCalled();
  });

  test("uses OR across classifications and AND for course, cohort, and title in rows and totals", async () => {
    const tx = {
      field: { findMany: vi.fn().mockResolvedValue([{ id: 1 }]) },
      category: { findMany: vi.fn().mockResolvedValue([{ id: 1 }]) },
      projectType: { findMany: vi.fn().mockResolvedValue([{ id: 1 }]) },
      project: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    };
    const repository = new ProjectRepository(tx as unknown as PrismaInstance);
    const query = {
      fieldIds: [1], categoryIds: [1], projectTypeIds: [1], courseID: [4], classBookID: [3],
      search: "AI", page: 1, pageSize: 9,
    };

    await repository.getProject(query);
    await repository.countProject(query);

    const where = {
      OR: [
        { projectFields: { some: { fieldID: { in: [1] } } } },
        { projectCategories: { some: { categoryID: { in: [1] } } } },
        { projectProjectTypes: { some: { typeID: { in: [1] } } } },
      ],
      projectCourses: { some: { courseID: { in: [4] }, deletedAt: null } },
      projectMembers: {
        some: {
          memberType: "STUDENT",
          deletedAt: null,
          user: { is: { student: { is: { classBookID: { in: [3] }, deletedAt: null } } } },
        },
      },
      title: { contains: "AI", mode: "insensitive" },
      deletedAt: null,
    };
    expect(tx.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(tx.project.count).toHaveBeenCalledWith({ where });
  });

  test("leaves omitted classification relations unchanged on update", async () => {
    const tx = {
      project: {
        update: vi.fn().mockResolvedValue({ id: 7 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 7 }),
      },
    };
    const db = { $transaction: (callback: (transaction: unknown) => unknown) => callback(tx) } as unknown as PrismaInstance;
    const repository = new ProjectRepository(db);

    await repository.updateProject(7, { title: "Updated", updatedAt: new Date() });

    expect(tx.project.update).toHaveBeenCalledOnce();
  });

  test("rejects a missing classification before running either project query", async () => {
    const tx = {
      field: { findMany: vi.fn().mockResolvedValue([]) },
      category: { findMany: vi.fn().mockResolvedValue([]) },
      projectType: { findMany: vi.fn().mockResolvedValue([]) },
      project: { findMany: vi.fn(), count: vi.fn() },
    };
    const repository = new ProjectRepository(tx as unknown as PrismaInstance);

    await expect(repository.getProject({ fieldIds: [999] })).rejects.toMatchObject({ statusCode: 400 });
    expect(tx.project.findMany).not.toHaveBeenCalled();
    expect(tx.project.count).not.toHaveBeenCalled();
  });

  test("rejects gallery images owned by another project before replacing the gallery", async () => {
    const tx = {
      projectImage: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      project: { update: vi.fn().mockResolvedValue({ id: 7 }) },
    };
    const db = { $transaction: (callback: (transaction: unknown) => unknown) => callback(tx) } as unknown as PrismaInstance;
    const repository = new ProjectRepository(db);

    await expect(repository.updateProject(7, { galleryImages: [{ imageID: 45 }], updatedAt: new Date() }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(tx.projectImage.deleteMany).not.toHaveBeenCalled();
  });
});
