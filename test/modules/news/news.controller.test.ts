import { describe, expect, test, vi } from "vitest";
import { Elysia } from "elysia";
import { responseEnhancer } from "../../../src/core/interceptor/response";
import type { NewsDTO, NewsWithAdditionalImageDTO } from "../../../src/modules/news/domain/news";
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
  tag: { id: 3, name: "ข่าวประชาสัมพันธ์", tagsGroupsId: 4 },
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
});
