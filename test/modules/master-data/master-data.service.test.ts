import { describe, expect, test } from "vitest";
import { MasterDataService } from "../../../src/modules/master-data/master-data.service";
import type { IMasterDataRepository } from "../../../src/modules/master-data/domain/master-data.repository";

describe("MasterDataService project classifications", () => {
  test("returns the three lookup tables alongside existing master data", async () => {
    const repository = {
      getTypeCourses: async () => [],
      getRoles: async () => [],
      getTags: async () => [],
      getTagGroup: async () => [],
      getPrefixes: async () => [],
      getNewsCategories: async () => [],
      getFields: async () => [{ id: 1, name: "Artificial intelligence" }],
      getCategories: async () => [{ id: 1, name: "Education" }],
      getProjectTypes: async () => [{ id: 1, name: "Research" }],
    } satisfies IMasterDataRepository;

    await expect(new MasterDataService(repository).getMasterData()).resolves.toMatchObject({
      fields: [{ id: 1, name: "Artificial intelligence" }],
      categories: [{ id: 1, name: "Education" }],
      projectTypes: [{ id: 1, name: "Research" }],
    });
  });
});
