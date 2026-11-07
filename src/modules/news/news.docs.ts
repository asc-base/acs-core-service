import { t } from "elysia";
import {
  CreateNewsDTO,
  NewsDTO,
  NewsQueryParams,
  NewsUpdateDTO,
  NewsWithAdditionalImageDTO,
} from "./domain/news";
import { mapResponse } from "../../core/interceptor/response";
import { Pageable } from "../../core/models";
export const NewsDocs = {
  createNews: {
    detail: {
      summary: "Create news",
      description: "Create a new news item with the provided information",
      tags: ["News"],
    },
    transform({ body }: { body: CreateNewsDTO }) {
      if (body.startDate && typeof body.startDate === "string") {
        body.startDate = new Date(body.startDate);
      }

      // เช็คและแปลง dueDate
      if (body.dueDate && typeof body.dueDate === "string") {
        body.dueDate = new Date(body.dueDate);
      }
      if (body.eventStartAt && typeof body.eventStartAt === "string") {
        body.eventStartAt = new Date(body.eventStartAt);
      }
      if ((body.eventEndAt as unknown) === "null") {
        body.eventEndAt = null;
      } else if (body.eventEndAt && typeof body.eventEndAt === "string") {
        body.eventEndAt = new Date(body.eventEndAt);
      }
    },
    body: CreateNewsDTO,
    response: {
      201: mapResponse(NewsWithAdditionalImageDTO),
    },
  },
  getNews: {
    detail: {
      summary: "Get all news",
      description: "Retrieve a list of all news items",
      tags: ["News"],
    },
    query: NewsQueryParams,
    response: {
      200: mapResponse(Pageable(NewsDTO)),
    },
  },
  getNewsById: {
    detail: {
      summary: "Get news by ID",
      description: "Retrieve a news item by its ID",
      tags: ["News"],
    },
    response: {
      200: mapResponse(NewsWithAdditionalImageDTO),
      404: mapResponse(t.Null()),
    },
  },
  deleteNews: {
    detail: {
      summary: "Delete news by ID.",
      description: "Delete a specific news by ID.",
      tags: ["News"],
    },
    params: t.Object({
      id: t.Numeric(),
    }),
    responses: {
      200: mapResponse(NewsDTO),
      404: mapResponse(t.Null()),
    },
  },
  updateNews: {
    detail: {
      summary: "Update News",
      description: "Update News by ID",
      tags: ["News"],
    },
    transform({ body }: { body: NewsUpdateDTO }) {
      Object.keys(body).forEach((key) => {
        const k = key as keyof NewsUpdateDTO;
        if (body[k] === "") {
          body[k] = undefined;
        }
      });
      if ((body.eventEndAt as unknown) === "null") body.eventEndAt = null;
      else if (typeof body.eventEndAt === "string") body.eventEndAt = new Date(body.eventEndAt);
      if (typeof body.eventStartAt === "string") body.eventStartAt = new Date(body.eventStartAt);
      if (typeof body.startDate === "string") body.startDate = new Date(body.startDate);
      if (typeof body.dueDate === "string") body.dueDate = new Date(body.dueDate);
    },
    params: t.Object({
      id: t.Numeric(),
    }),
    body: NewsUpdateDTO,
    response: {
      200: mapResponse(NewsWithAdditionalImageDTO),
    },
  },
};
