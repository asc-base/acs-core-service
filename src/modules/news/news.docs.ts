import { t } from "elysia";
import {
  CreateNewsDTO,
  NewsDTO,
  NewsFeatureDTO,
  NewsQueryParams,
  UpsertNewsFeatureDTO,
  QueryNewsFeatureParams,
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
  upsertNewsFeature: {
    detail: {
      summary: "Upsert news feature",
      description:
        "Create or update a news feature with the provided information",
      tags: ["News"],
    },
    body: UpsertNewsFeatureDTO,
    response: {
      200: mapResponse(NewsFeatureDTO),
    },
  },
  getNewsFeatures: {
    detail: {
      summary: "Get news features",
      description: "Retrieve a list of news features based on query parameters",
      tags: ["News"],
    },
    query: QueryNewsFeatureParams,
    response: {
      200: mapResponse(Pageable(NewsFeatureDTO)),
    },
  },

  getNewsFeatureById: {
    detail: {
      summary: "Get news feature by ID",
      description: "Retrieve a news feature by its ID",
      tags: ["News"],
    },
    params: t.Object({
      id: t.Numeric(),
    }),
    response: {
      200: mapResponse(NewsFeatureDTO),
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
