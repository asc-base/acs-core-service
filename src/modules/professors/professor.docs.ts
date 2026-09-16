import { t } from "elysia";
import { mapResponse } from "../../core/interceptor/response";
import {
  ProfessorDTO,
  ProfessorQueryParams,
  ProfessorUpdateDTO,
  CreateProfessorDTO,
} from "./domain/professor";
import { Pageable } from "../../core/models";

export const ProfessorDocs = {
  createProfessor: {
    detail: {
      summary: "Creates a new professor in the system.",
      description:
        "This endpoint allows for the creation of a new professor by accepting the necessary data and returning the created professor's details.",
      tags: ["Professors"],
    },
    transform({ body }: { body: ProfessorUpdateDTO }) {
      if (body.expertFields != null && body.expertFields !== "") {
        body.expertFields = body.expertFields.replaceAll(",", "/");
      }
      if (body.educations != null && body.educations !== "") {
        body.educations = body.educations.replaceAll(",", "/");
      }
    },
    body: CreateProfessorDTO,
    responses: {
      201: mapResponse(ProfessorDTO),
    },
  },
  getProfessors: {
    detail: {
      summary: "Retrieves a list of professors.",
      description:
        "This endpoint fetches a list of all professors in the system, returning their details.",
      tags: ["Professors"],
    },
    query: ProfessorQueryParams,
    responses: {
      200: mapResponse(Pageable(ProfessorDTO)),
      500: mapResponse(t.Null()),
    },
  },
  getProfessorById: {
    detail: {
      summary: "Retrieves a professor by ID.",
      description:
        "This endpoint fetches the details of a specific professor using their unique ID.",
      tags: ["Professors"],
    },
    params: t.Object({
      id: t.Number(),
    }),
    responses: {
      200: mapResponse(ProfessorDTO),
      404: mapResponse(t.Null()),
    },
  },
  updateProfessor: {
    detail: {
      summary: "Updates an existing professor's details.",
      description:
        "This endpoint allows for updating the details of an existing professor by their ID.",
      tags: ["Professors"],
    },
    transform({ body }: { body: ProfessorUpdateDTO }) {
      if (body.expertFields != null && body.expertFields !== "") {
        body.expertFields = body.expertFields.replaceAll(",", "/");
      }
      if (body.educations != null && body.educations !== "") {
        body.educations = body.educations.replaceAll(",", "/");
      }

      Object.keys(body).forEach((key) => {
        const k = key as keyof ProfessorUpdateDTO;
        if (body[k] === "") {
          body[k] = undefined;
        }
      });
    },
    params: t.Object({
      id: t.Numeric(),
    }),
    body: ProfessorUpdateDTO,
    responses: {
      200: mapResponse(ProfessorDTO),
      404: mapResponse(t.Null()),
    },
  },
  deleteProfessor: {
    detail: {
      summary: "Delete professor by ID.",
      description: "Delete a specific professor by ID.",
      tags: ["Professors"],
    },
    params: t.Object({
      id: t.Numeric(),
    }),
    responses: {
      200: mapResponse(ProfessorDTO),
      404: mapResponse(t.Null()),
    },
  },
};
