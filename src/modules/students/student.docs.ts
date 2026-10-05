import {
  CreateStudentDTO,
  StudentDTO,
  StudentQueryParams,
  StudentUpdateDTO,
  StudentBatchUploadDTO,
} from "./domain/student";
import { mapResponse } from "../../core/interceptor/response";

import { t } from "elysia";
import { Pageable } from "../../core/models";
export const StudentDocs = {
  createStudent: {
    detail: {
      summary: "Create student",
      description: "Create a new student with the provided information",
      tags: ["Students"],
    },
    body: CreateStudentDTO,
    response: {
      201: mapResponse(StudentDTO),
    },
  },
  getStudents: {
    detail: {
      summary: "Get student",
      description: "Retrieve a student's information by their ID",
      tags: ["Students"],
    },
    query: StudentQueryParams,
    response: {
      200: mapResponse(Pageable(StudentDTO)),
    },
  },
  getStudentById: {
    detail: {
      summary: "Get student by ID",
      description: "Retrieve a student's information by their ID",
      tags: ["Students"],
    },
    params: t.Object({
      id: t.Number(),
    }),
    response: {
      200: mapResponse(StudentDTO),
      404: mapResponse(t.Null()),
    },
  },
  getStudentByUserId: {
    detail: {
      summary: "Get student by user ID",
      description: "Retrieve a student's information by their user ID",
      tags: ["Students"],
    },
    params: t.Object({
      userId: t.Number(),
    }),
    response: {
      200: mapResponse(StudentDTO),
      404: mapResponse(t.Null()),
    },
  },
  deleteStudent: {
    detail: {
      summary: "Delete student",
      description: "Delete a student's information by their ID",
      tags: ["Students"],
    },
    params: t.Object({
      id: t.Number(),
    }),
    response: {
      200: mapResponse(StudentDTO),
    },
  },
  updateStudent: {
    detail: {
      summary: "Update student",
      description: "Update a student's information by their ID",
      tags: ["Students"],
    },
    transform({ body }: { body: StudentUpdateDTO }) {
      Object.keys(body).forEach((key) => {
        const k = key as keyof StudentUpdateDTO;
        if (body[k] === "") {
          body[k] = undefined;
        }
      });
    },
    params: t.Object({
      id: t.Numeric(),
    }),
    body: StudentUpdateDTO,
    response: {
      200: mapResponse(StudentDTO),
    },
  },
  createStudentBatch: {
    detail: {
      summary: "Import students via CSV or Excel file",
      description: "Upload a CSV, XLS, or XLSX file to bulk import students.",
      tags: ["Students"],
    },
    body: StudentBatchUploadDTO,
    response: {
      200: mapResponse(t.Null()),
      400: mapResponse(t.Null()),
      409: mapResponse(t.Null()),
    },
  },
};
