import { describe, expect, test, vi } from "vitest";
import { ProjectRepository } from "../../../src/infrastructure/project.repository";
import type { PrismaInstance } from "../../../src/lib/db";

describe("ProjectRepository classification filters", () => {
  test("uses OR across classification groups for both rows and totals", async () => {
    const tx = {
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

  test("maps legacy tag IDs to lookup IDs by group and name, with unmatched IDs as fallback", async () => {
    const tx = {
      tag: { findMany: vi.fn().mockResolvedValue([
        { id: 19, name: "Education", tageGroups: { name: "category" } },
        { id: 200, name: "External", tageGroups: { name: "custom" } },
      ]) },
      field: { findMany: vi.fn().mockResolvedValue([]) },
      category: { findMany: vi.fn().mockResolvedValue([{ id: 1, name: "Education" }]) },
      projectType: { findMany: vi.fn().mockResolvedValue([]) },
      project: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const repository = new ProjectRepository(tx as unknown as PrismaInstance);

    await repository.getProject({ tagID: [19, 200] });

    expect(tx.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { projectCategories: { some: { categoryID: { in: [1] } } } },
          { projectTags: { some: { deletedAt: null, tagID: { in: [200] } } } },
        ],
        deletedAt: null,
      },
    }));
  });
});
