import { describe, expect, test, vi } from "vitest";
import type { Prisma } from "../../src/generated/prisma/client";
import { mapProjectClassificationSeeds, writeProjectClassifications } from "../../src/infrastructure/sync-project-classifications";

describe("project classification migration", () => {
  test("keeps canonical IDs and includes custom legacy lookup values", () => {
    const plan = mapProjectClassificationSeeds("categories", [], [
      { id: 19, name: "Education", groupName: "category" },
      { id: 28, name: "Custom category", groupName: "category" },
    ]);

    expect(plan.missing[0]).toEqual({ id: 1, name: "Education" });
    expect(plan.extras).toEqual([{ id: 28, name: "Custom category", groupName: "category" }]);
    expect(plan.conflicts).toEqual([]);
  });

  test("rejects an ID occupied by a different lookup name", () => {
    expect(mapProjectClassificationSeeds("projectTypes", [{ id: 1, name: "Custom" }], []).conflicts)
      .toContain("projectTypes ID 1 is occupied by Custom");
  });

  test("maps a canonical category ID to its different legacy tag ID by name", async () => {
    const categoryTag = { id: 19, name: "Education", tageGroups: { name: "category" } };
    const tx = {
      tag: { findMany: vi.fn().mockResolvedValue([categoryTag]) },
      projectTag: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), upsert: vi.fn() },
      projectField: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      projectCategory: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), createMany: vi.fn() },
      projectProjectType: { findMany: vi.fn().mockResolvedValue([]) },
      field: { findMany: vi.fn().mockResolvedValue([]) },
      category: { findMany: vi.fn().mockResolvedValue([{ id: 1, name: "Education" }]) },
      projectType: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await writeProjectClassifications(tx as unknown as Prisma.TransactionClient, 7, {
      categoryIds: [1],
      newtagsID: [19],
    });

    expect(tx.projectCategory.createMany).toHaveBeenCalledWith({ data: [{ projectID: 7, categoryID: 1 }], skipDuplicates: true });
    expect(tx.projectTag.upsert).toHaveBeenCalledWith({
      where: { projectID_tagID: { projectID: 7, tagID: 19 } },
      create: { projectID: 7, tagID: 19 },
      update: { deletedAt: null },
    });
  });

  test("leaves existing fields unchanged when update omits field IDs", async () => {
    const fieldTag = { id: 1, name: "Artificial intelligence", tageGroups: { name: "field" } };
    const categoryTag = { id: 20, name: "Medical", tageGroups: { name: "category" } };
    const tx = {
      tag: { findMany: vi.fn().mockResolvedValue([fieldTag, categoryTag]) },
      projectTag: {
        findMany: vi.fn().mockResolvedValue([{ projectID: 7, tagID: 1, tag: fieldTag }]),
        deleteMany: vi.fn(), upsert: vi.fn(),
      },
      projectField: { deleteMany: vi.fn(), createMany: vi.fn() },
      projectCategory: { deleteMany: vi.fn(), createMany: vi.fn() },
      projectProjectType: { deleteMany: vi.fn(), createMany: vi.fn() },
      field: { findMany: vi.fn().mockResolvedValue([{ id: 1, name: "Artificial intelligence" }]) },
      category: { findMany: vi.fn().mockResolvedValue([{ id: 2, name: "Medical" }]) },
      projectType: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await writeProjectClassifications(tx as unknown as Prisma.TransactionClient, 7, { categoryIds: [2] });

    expect(tx.projectField.deleteMany).not.toHaveBeenCalled();
    expect(tx.projectTag.deleteMany).not.toHaveBeenCalled();
    expect(tx.projectField.deleteMany).not.toHaveBeenCalled();
    expect(tx.projectCategory.createMany).toHaveBeenCalledWith({ data: [{ projectID: 7, categoryID: 2 }], skipDuplicates: true });
  });

  test("rejects legacy and new IDs that select different names", async () => {
    const tx = {
      tag: { findMany: vi.fn().mockResolvedValue([{ id: 20, name: "Medical", tageGroups: { name: "category" } }]) },
      projectTag: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), upsert: vi.fn() },
      projectField: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      projectCategory: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), createMany: vi.fn() },
      projectProjectType: { findMany: vi.fn().mockResolvedValue([]) },
      field: { findMany: vi.fn().mockResolvedValue([]) },
      category: { findMany: vi.fn().mockResolvedValue([{ id: 1, name: "Education" }, { id: 2, name: "Medical" }]) },
      projectType: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await expect(writeProjectClassifications(tx as unknown as Prisma.TransactionClient, 7, {
      categoryIds: [1],
      newtagsID: [20],
    })).rejects.toThrow("categoryIds and legacy tag IDs must select the same names");
    expect(tx.projectCategory.createMany).not.toHaveBeenCalled();
    expect(tx.projectTag.upsert).not.toHaveBeenCalled();
  });
});
