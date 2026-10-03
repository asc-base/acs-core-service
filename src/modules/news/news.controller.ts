import Elysia from "elysia";
import { t } from "elysia";
import { NewsRepository } from "../../infrastructure/news.repository";
import { prisma } from "../../lib/db";
import { NewsService } from "./news.service";
import { NewsDocs } from "./news.docs";
import { success } from "../../core/interceptor/response";
import { NewsFactory } from "./news.factory";
import { createNewsImageStorage } from "../../infrastructure/profile-image-storage";
import { HttpStatusCode } from "../../core/types/http";
import { authMiddleware } from "../../middleware/auth";
import { roleMacro } from "../../middleware/checkRole";
import { PERMISSION } from "../../core/permission/permission";
import { AppError } from "../../core/error/app-error";

const newsRepository = new NewsRepository(prisma);
const newsFactory = new NewsFactory();
const newsImageStorage = createNewsImageStorage();
const defaultNewsService = new NewsService(
  newsRepository,
  newsFactory,
  newsImageStorage,
);

export const createNewsController =
  (newsService: NewsService = defaultNewsService) =>
    (app: Elysia) =>
      app.decorate("newsService", newsService).group("/news", (app) =>
        app
          .guard({}, (admin) =>
            admin
              .use(authMiddleware)
              .use(roleMacro)
              .post(
                "",
                async ({ newsService, body, set }) => {
                  const news = await newsService.createNews(body);
                  set.status = HttpStatusCode.CREATED;
                  return success(
                    news,
                    "News created successfully",
                    HttpStatusCode.CREATED,
                  );
                },
                {
                  ...NewsDocs.createNews,
                  checkRole: PERMISSION.ADMINPERSMISSION,
                },
              )
              .put(
                "/news-features",
                async ({ newsService, body, set }) => {
                  const newsFeature = await newsService.upsertNewsFeature(body);
                  set.status = HttpStatusCode.OK;
                  return success(
                    newsFeature,
                    "News feature upserted successfully",
                  );
                },
                {
                  ...NewsDocs.upsertNewsFeature,
                  checkRole: PERMISSION.ADMINPERSMISSION,
                },
              )
              .patch(
                "/:id",
                async ({ newsService, params, body }) => {
                  const news = await newsService.updateNews(
                    Number(params.id),
                    body,
                  );
                  return success(news, "News updated successfully");
                },
                {
                  ...NewsDocs.updateNews,
                  checkRole: PERMISSION.ADMINPERSMISSION,
                },
              )
              .delete(
                "/:id",
                async ({ newsService, params, set }) => {
                  const news = await newsService.deleteNews(Number(params.id));
                  set.status = HttpStatusCode.OK;
                  return success(news, "News deleted successfully");
                },
                {
                  ...NewsDocs.deleteNews,
                  checkRole: PERMISSION.ADMINPERSMISSION,
                },
              ),
          )
          .group("/:id/bulletins", (app) =>
            app
              .guard({}, (admin) => admin
                .use(authMiddleware)
                .use(roleMacro)
                .put(
                  "/:type",
                  async ({ newsService, params, set }) => {
                    const newsID = Number(params.id);
                    const type = params.type;
                    try {
                      const bulletin = await newsService.setNewsBulletin(newsID, type, true);
                      if (!bulletin) throw new Error("News bulletin not found");
                      return success(bulletin, "News bulletin enabled successfully");
                    } catch (error) {
                      if (error instanceof AppError && error.statusCode === HttpStatusCode.NOT_FOUND) {
                        set.status = HttpStatusCode.NOT_FOUND;
                        return success(null, "News not found", HttpStatusCode.NOT_FOUND);
                      }
                      throw error;
                    }
                  },
                  {
                    params: t.Object({ id: t.Numeric(), type: t.Union([t.Literal("HIGHLIGHT"), t.Literal("ANNOUNCEMENT")]) }),
                    response: { 200: t.Any(), 404: t.Any() },
                    checkRole: PERMISSION.ADMINPERSMISSION,
                  },
                )
                .delete(
                  "/:type",
                  async ({ newsService, params, set }) => {
                    const newsID = Number(params.id);
                    const result = await newsService.setNewsBulletin(newsID, params.type, false);
                    if (!result) {
                      set.status = HttpStatusCode.NOT_FOUND;
                      return success(null, "News bulletin not found", HttpStatusCode.NOT_FOUND);
                    }
                    return success(null, "News bulletin disabled successfully");
                  },
                  {
                    params: t.Object({ id: t.Numeric(), type: t.Union([t.Literal("HIGHLIGHT"), t.Literal("ANNOUNCEMENT")]) }),
                    response: { 200: t.Any(), 404: t.Any() },
                    checkRole: PERMISSION.ADMINPERSMISSION,
                  },
                ),
              ),
          )
          .get(
            "/bulletins",
            async ({ newsService, query }) => {
              const rows = await newsService.getNewsBulletins(query.type);
              return success(rows, "News bulletins retrieved successfully");
            },
            {
              query: t.Object({ type: t.Union([t.Literal("HIGHLIGHT"), t.Literal("ANNOUNCEMENT")]) }),
              response: { 200: t.Any() },
            },
          )
          .get(
            "",
            async ({ newsService, query, set }) => {
              const newsList = await newsService.getNews(query);
              set.status = HttpStatusCode.OK;
              return success(newsList, "News retrieved successfully");
            },
            NewsDocs.getNews,
          )
          .get(
            "/:id",
            async ({ newsService, params, set }) => {
              const news = await newsService.getNewsById(Number(params.id));
              if (!news) {
                set.status = HttpStatusCode.NOT_FOUND;
                return success(null, "News not found", HttpStatusCode.NOT_FOUND);
              }
              return success(news, "News retrieved successfully");
            },
            NewsDocs.getNewsById,
          )
          .group("/news-features", (app) =>
            app
              .get(
                "",
                async ({ newsService, query, set }) => {
                  const newsFeatures = await newsService.getNewsFeatures(query);
                  set.status = HttpStatusCode.OK;
                  return success(
                    newsFeatures,
                    "News features retrieved successfully",
                  );
                },
                NewsDocs.getNewsFeatures,
              )
              .get(
                "/:id",
                async ({ newsService, params, set }) => {
                  const newsFeature = await newsService.getNewsFeatureById(
                    Number(params.id),
                  );
                  if (!newsFeature) {
                    set.status = HttpStatusCode.NOT_FOUND;
                    return success(
                      null,
                      "News feature not found",
                      HttpStatusCode.NOT_FOUND,
                    );
                  }
                  return success(
                    newsFeature,
                    "News feature retrieved successfully",
                  );
                },
                NewsDocs.getNewsFeatureById,
              ),
          ),
      );

export const newsController = createNewsController();
