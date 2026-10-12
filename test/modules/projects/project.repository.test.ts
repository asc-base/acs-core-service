import { describe, expect, test, vi } from "vitest";
import { ProjectRepository } from "../../../src/infrastructure/project.repository";
import type { PrismaInstance } from "../../../src/lib/db";

describe("ProjectRepository classification filters", () => {
  test("uses OR across classification groups for both rows and totals", async () => {
    const tx = {
      field: { findMany: vi.fn().mockResolvedValue([{ id: 1 }]) },
      category: { findMany: vi.fn().mockResolvedValue([{ id: 1 }]) },
      projectType: { findMany: vi.fn().mockResolvedValue([{ id: 1 }]) },
      project: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    };
    const repository = new ProjectRepository(tx as unknown as PrismaInstance);
    const query = {
      fieldIds: [1], categoryIds: [1], projectTypeIds: [1], courseID: [4],
      search: "AI", searchBy: "title", page: 1, pageSize: 9,
    };

    await repository.getProject(query);
    await repository.countProject(query);

    const where = {
      OR: [
        { projectFields: { some: { fieldID: { in: [1] } } } },
        { projectCategories: { some: { categoryID: { in: [1] } } } },
        { projectProjectTypes: { some: { typeID: { in: [1] } } } },
      ],
      projectCourses: { some: { courseID: { in: [4] } } },
      title: { contains: "AI", mode: "insensitive" },
      deletedAt: null,
    };
    expect(tx.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(tx.project.count).toHaveBeenCalledWith({ where });
  });

  test("keeps classifications when an update omits those groups", async () => {
    const tx = {
      field: { findMany: vi.fn().mockResolvedValue([]) },
      category: { findMany: vi.fn().mockResolvedValue([]) },
      projectType: { findMany: vi.fn().mockResolvedValue([]) },
      projectField: { deleteMany: vi.fn(), createMany: vi.fn() },
      projectCategory: { deleteMany: vi.fn(), createMany: vi.fn() },
      projectProjectType: { deleteMany: vi.fn(), createMany: vi.fn() },
      projectImage: { createMany: vi.fn() },
      project: {
        update: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 7 }),
      },
    };
    const db = { $transaction: (callback: (transaction: unknown) => unknown) => callback(tx) } as unknown as PrismaInstance;
    const repository = new ProjectRepository(db);

    await repository.updateProject(7, { title: "Updated" });

    expect(tx.projectCategory.deleteMany).not.toHaveBeenCalled();
    expect(tx.projectProjectType.deleteMany).not.toHaveBeenCalled();
  });

  test("rejects filter IDs that do not exist in their lookup table", async () => {
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
});
