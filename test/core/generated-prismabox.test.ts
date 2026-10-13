import { describe, expect, test } from "vitest";
import { Elysia, t } from "elysia";
import {
  CreateNewsDTO,
  NewsBulletinTypeSchema,
  NewsDTO,
  NewsSchema,
  NewsWithAdditionalImageSchema,
} from "../../src/modules/news/domain/news";
import { ProjectSchema } from "../../src/modules/projects/domain/project";

describe("Prisma generated Elysia schemas", () => {
  test("composes generated database fields with timestamps and relations", async () => {
    const date = new Date("2026-10-13T00:00:00.000Z");
    const news = {
      id: 1,
      title: "News",
      detail: "Details",
      startDate: date,
      dueDate: null,
      thumbnail: null,
      createdAt: date,
      updatedAt: date,
      deletedAt: null,
      category: null,
    };
    const project = {
      id: 1,
      title: "Project",
      detail: "Details",
      githubURL: "",
      presentationURL: "",
      documentURL: "",
      youtubeURL: "",
      figmaURL: null,
      thumbnailURL: "/thumbnail.png",
      thumbnailContentType: null,
      thumbnailFocalPointX: null,
      thumbnailFocalPointY: null,
      imageID: null,
      techStacks: [],
      fields: [{ id: 1, name: "AI" }],
      categories: [],
      projectTypes: [],
      members: [],
      courses: [],
      createdAt: date,
      updatedAt: date,
      deletedAt: null,
      images: [],
    };
    const app = new Elysia()
      .get("/news-model", () => news, { response: NewsSchema })
      .get(
        "/news-with-images",
        () => ({
          ...news,
          newsAdditionalImages: [
            {
              id: 2,
              newsID: 1,
              imageUrl: "/extra.png",
              createdAt: date,
              updatedAt: date,
              deletedAt: null,
            },
          ],
        }),
        { response: NewsWithAdditionalImageSchema },
      )
      .get("/project-model", () => project, { response: ProjectSchema });

    for (const path of ["/news-model", "/news-with-images", "/project-model"]) {
      expect(
        (await app.handle(new Request(`http://localhost${path}`))).status,
      ).toBe(200);
    }
  });

  test("keeps nullable news categories and Date response serialization", async () => {
    const date = new Date("2026-10-13T00:00:00.000Z");
    const app = new Elysia().get(
      "/news",
      () => ({
        id: 1,
        title: "News",
        detail: "Details",
        startDate: date,
        thumbnailURL: null,
        category: null,
      }),
      { response: NewsDTO },
    );

    const response = await app.handle(new Request("http://localhost/news"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      startDate: "2026-10-13T00:00:00.000Z",
      category: null,
    });
  });

  test("decodes ISO dates, accepts nullable optional dates, and rejects invalid bodies", async () => {
    const app = new Elysia().post(
      "/news",
      ({ body }) => ({
        startDate: body.startDate?.toISOString() ?? null,
        dueDate: body.dueDate?.toISOString() ?? null,
      }),
      {
        body: CreateNewsDTO,
        response: t.Object({
          startDate: t.Nullable(t.String()),
          dueDate: t.Nullable(t.String()),
        }),
      },
    );
    const post = (body: object) =>
      app.handle(
        new Request("http://localhost/news", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    const valid = await post({
      title: "News",
      detail: "Details",
      newsCategoryId: 1,
      startDate: "2026-10-13T00:00:00.000Z",
      dueDate: null,
    });
    const missingCategory = await post({ title: "News", detail: "Details" });
    const invalidDate = await post({
      title: "News",
      detail: "Details",
      newsCategoryId: 1,
      startDate: "invalid",
    });

    expect(valid.status).toBe(200);
    expect(await valid.json()).toEqual({
      startDate: "2026-10-13T00:00:00.000Z",
      dueDate: null,
    });
    expect(missingCategory.status).toBe(422);
    expect(invalidDate.status).toBe(422);
  });

  test("uses the Prisma enum for bulletin validation", async () => {
    const app = new Elysia().post("/bulletin", ({ body }) => body, {
      body: t.Object({ type: NewsBulletinTypeSchema }),
    });
    const post = (type: string) =>
      app.handle(
        new Request("http://localhost/bulletin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type }),
        }),
      );

    expect((await post("HIGHLIGHT")).status).toBe(200);
    expect((await post("OTHER")).status).toBe(422);
  });
});
