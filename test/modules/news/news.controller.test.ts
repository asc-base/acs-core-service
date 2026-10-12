import { describe, expect, test, vi } from "vitest";
import { Elysia, t } from "elysia";
import { responseEnhancer } from "../../../src/core/interceptor/response";
import type { NewsDTO, NewsWithAdditionalImageDTO } from "../../../src/modules/news/domain/news";
import { CreateNewsDTO, NewsUpdateDTO } from "../../../src/modules/news/domain/news";
import { createNewsController } from "../../../src/modules/news/news.controller";
import type { NewsService } from "../../../src/modules/news/news.service";

vi.mock("../../../src/lib/db", () => ({ prisma: {} }));

const newsFixture = (): NewsDTO => ({
  id: 7,
  title: "News title",
  detail: "News detail",
  startDate: new Date("2026-08-02T00:00:00.000Z"),
  dueDate: null,
  thumbnailURL: "https://example.com/card.jpg",
  highlightURL: "https://example.com/thumbnail.jpg",
  cardFocalPointX: 25,
  cardFocalPointY: 75,
  thumbnailFocalPointX: 40,
  thumbnailFocalPointY: 60,
  category: { id: 3, code: "ANNOUNCEMENT", name: "ข่าวประชาสัมพันธ์" },
  images: [{ id: 1, imageID: 12, imageType: "THUMBNAIL", imageUrl: "https://example.com/thumbnail.jpg", focalPointX: 40, focalPointY: 60, sortOrder: 0 }],
});

const createApp = (newsService: NewsService) =>
  new Elysia().use(responseEnhancer).use(createNewsController(newsService));

describe("news read endpoints", () => {
  test("returns news with category, role images, and focal points", async () => {
    const app = createApp({
      getNews: async () => ({ rows: [newsFixture()], totalRecords: 1, page: 1, pageSize: 10 }),
    } as unknown as NewsService);
    const response = await app.handle(new Request("http://localhost/news"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.rows[0]).toMatchObject({
      category: { code: "ANNOUNCEMENT" },
      images: [{ imageType: "THUMBNAIL", focalPointX: 40, focalPointY: 60 }],
      cardFocalPointX: 25,
    });
  });

  test("returns a news item with an empty detail gallery", async () => {
    const result: NewsWithAdditionalImageDTO = { ...newsFixture(), newsAdditionalImages: [] };
    const app = createApp({ getNewsById: async () => result } as unknown as NewsService);
    const response = await app.handle(new Request("http://localhost/news/7"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ id: 7, newsAdditionalImages: [], category: { id: 3 } });
  });

  test("returns only bulletins of the requested type", async () => {
    const app = createApp({
      getNewsBulletins: async (type: "HIGHLIGHT" | "ANNOUNCEMENT") => [
        { id: 3, newsID: 7, type, news: newsFixture() },
      ],
    } as unknown as NewsService);
    const response = await app.handle(new Request("http://localhost/news/bulletins?type=HIGHLIGHT"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject([{ type: "HIGHLIGHT", news: { category: { code: "ANNOUNCEMENT" } } }]);
  });

  test("rejects legacy tag filters and returns 404 for the retired feature route", async () => {
    const service = { getNews: vi.fn(async () => ({ rows: [], totalRecords: 0, page: 1, pageSize: 10 })) } as unknown as NewsService;
    const app = createApp(service);

    expect((await app.handle(new Request("http://localhost/news?tagID=16"))).status).toBe(400);
    expect((await app.handle(new Request("http://localhost/news/news-features"))).status).toBe(404);
    expect(service.getNews).not.toHaveBeenCalled();
  });

  test("rejects retired tag fields in create and update payloads", async () => {
    const app = new Elysia()
      .post("/news", ({ body }) => body, { body: CreateNewsDTO })
      .patch("/news/:id", ({ body }) => body, { params: t.Object({ id: t.Numeric() }), body: NewsUpdateDTO });
    const create = await app.handle(new Request("http://localhost/news", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "News", detail: "Details", newsCategoryId: 1, tagID: 16 }),
    }));
    const update = await app.handle(new Request("http://localhost/news/1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tagID: 16 }),
    }));

    expect(create.status).toBe(422);
    expect(update.status).toBe(422);
  });
});
