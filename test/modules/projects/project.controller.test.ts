import { describe, expect, test, vi } from "vitest";
import { Elysia } from "elysia";
import { t } from "elysia";
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

  test("rejects retired tag fields in project payloads", async () => {
    const app = new Elysia().put("/project/:id", ({ body }) => body, {
      params: t.Object({ id: t.Numeric() }),
      body: UpdateProjectDTO,
    });
    const response = await app.handle(new Request("http://localhost/project/7", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tagsID: [16], newtagsID: [16], deletedtagsID: [16] }),
    }));
    expect(response.status).toBe(422);
  });
});
