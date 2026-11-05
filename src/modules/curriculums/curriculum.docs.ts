import { t } from "elysia";
import { mapResponse } from "../../core/interceptor/response";
import {
  CreateCurriculumDTO,
  CurriculumDTO,
  CurriculumIdParam,
  CurriculumQueryParams,
  UpdateCurriculumDTO,
} from "./domain/curriculum";
import { Pageable } from "../../core/models";

export const CurriculumDocs = {
  createCurruculum: {
    detail: {
      summary: "Create a new curriculum",
      description: "Create a new curriculum with the provided information",
      tags: ["Curriculum"],
    },
    body: CreateCurriculumDTO,
    response: {
      201: mapResponse(CurriculumDTO),
      409: mapResponse(t.Null()),
    },
  },

  getCurriculums: {
    detail: {
      summary: "Get list of curriculums",
      description: "Retrieve a list of all curriculums",
      tags: ["Curriculum"],
    },
    query: CurriculumQueryParams,
    response: {
      200: mapResponse(Pageable(CurriculumDTO)),
      500: mapResponse(t.Null()),
    },
  },

  getCurriculumById: {
    detail: {
      summary: "Get curriculum by ID",
      description: "Retrieve a specific curriculum by its unique ID",
      tags: ["Curriculum"],
    },
    params: CurriculumIdParam,
    response: {
      200: mapResponse(CurriculumDTO),
      404: mapResponse(t.Null()),
    },
  },

  updateCurriculum: {
    detail: {
      summary: "Update an existing curriculum",
      description: "Update curriculum details. All fields are optional.",
      tags: ["Curriculum"],
    },
    params: CurriculumIdParam,
    body: UpdateCurriculumDTO,
    response: {
      200: mapResponse(CurriculumDTO),
      404: mapResponse(t.Null()),
      409: mapResponse(t.Null()),
    },
  },

  deleteCurriculum: {
    detail: {
      summary: "Delete a curriculum",
      description: "Delete a specific curriculum by its unique ID",
      tags: ["Curriculum"],
    },
    params: CurriculumIdParam,
    response: {
      200: mapResponse(CurriculumDTO),
      404: mapResponse(t.Null()),
    },
  },
};
