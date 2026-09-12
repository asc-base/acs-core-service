import Elysia from "elysia";
import { NewsRepository } from "../../infrastructure/news.repository";
import { prisma } from "../../lib/db";
import { NewsService } from "./news.service";
import { NewsDocs } from "./news.docs";
import { success } from "../../core/interceptor/response";
import { NewsFactory } from "./news.factory";
import { SupabaseService } from "../../core/utils/supabase";
import { HttpStatusCode } from "../../core/types/http";
import { authMiddleware } from "../../middleware/auth";
import { roleMacro } from "../../middleware/checkRole";
import { PERMISSION } from "../../core/permission/permission";

const newsRepository = new NewsRepository(prisma);
const newsFactory = new NewsFactory();
const supabaseService = new SupabaseService();
const defaultNewsService = new NewsService(
  newsRepository,
  newsFactory,
  supabaseService,
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
                async ({ newsService, body, set, userID }) => {
                  const news = await newsService.createNews(body, userID);
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
                async ({ newsService, body, set, userID }) => {
                  const newsFeature = await newsService.upsertNewsFeature(body, userID);
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
                async ({ newsService, params, body, userID }) => {
                  const news = await newsService.updateNews(
                    Number(params.id),
                    body,
                    userID,
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
