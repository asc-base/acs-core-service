import { describe, expect, test, vi } from "vitest";
import { Elysia } from "elysia";
import { Value } from "@sinclair/typebox/value";
import { responseEnhancer } from "../../../src/core/interceptor/response";
import { ProjectController } from "../../../src/modules/projects/project.controller";
import { UpdateProjectDTO } from "../../../src/modules/projects/domain/project";

vi.mock("../../../src/lib/db", () => ({ prisma: {} }));
vi.mock("../../../src/infrastructure/profile-image-storage", () => ({
  createCentralImageStorage: () => ({ upload: vi.fn(), delete: vi.fn() }),
}));

describe("project controller query contract", () => {
  test.each(["tagID=16", "tagId=16", "fields=16", "categories=2", "types=1"])(
    "rejects the retired filter %s",
    async (query) => {
      const app = new Elysia().use(responseEnhancer).use(ProjectController);
      const response = await app.handle(new Request(`http://localhost/project?${query}`));
      expect(response.status).toBe(400);
    },
  );

  test("validates the JSON relation payload and rejects removed fields", () => {
    expect(Value.Check(UpdateProjectDTO, {
      members: [{ userID: 7, memberType: "STUDENT", position: "Backend" }],
      courseIds: [4],
      gallery: [{ imageID: 12 }],
    })).toBe(true);
    expect(Value.Check(UpdateProjectDTO, {
      details: "old field",
      newMembers: [{ userID: 7, roleID: 2 }],
    })).toBe(false);
  });
});
