import { describe, expect, test, vi } from "vitest";
import { MasterDataService } from "../../../src/modules/master-data/master-data.service";
import type { IMasterDataRepository } from "../../../src/modules/master-data/domain/master-data.repository";

describe("MasterDataService project classifications", () => {
  test("returns the three lookup tables alongside existing master data", async () => {
    const getFields = vi.fn(async () => [{ id: 1, name: "Artificial intelligence" }]);
    const getCategories = vi.fn(async () => [{ id: 1, name: "Education" }]);
    const getProjectTypes = vi.fn(async () => [{ id: 1, name: "Research" }]);
    const getTechStacks = vi.fn(async () => [{ id: 1, name: "TypeScript" }]);
    const repository = {
      getTypeCourses: async () => [],
      getRoles: async () => [],
      getPrefixes: async () => [],
      getNewsCategories: async () => [],
      getFields,
      getCategories,
      getProjectTypes,
      getTechStacks,
    } satisfies IMasterDataRepository;

    await expect(new MasterDataService(repository).getMasterData()).resolves.toMatchObject({
      fields: [{ id: 1, name: "Artificial intelligence" }],
      categories: [{ id: 1, name: "Education" }],
      projectTypes: [{ id: 1, name: "Research" }],
      techStacks: [{ id: 1, name: "TypeScript" }],
    });
    expect(getFields).toHaveBeenCalledOnce();
    expect(getCategories).toHaveBeenCalledOnce();
    expect(getProjectTypes).toHaveBeenCalledOnce();
    expect(getTechStacks).toHaveBeenCalledOnce();
  });
});
