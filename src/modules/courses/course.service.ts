import {
  CreateCourseDTO,
  CourseDTO,
  CourseQueryParams,
  UpdateCourseDTO,
  CourseCreatePayload,
} from "./domain/course";
import { parse } from "csv-parse/sync";
import * as xlsx from "xlsx";
import { Value } from "@sinclair/typebox/value";
import { ICourseRepository } from "../courses/domain/course.repository";
import { ICourseFactory } from "./course.factory";
import { PageableType } from "../../core/models";
import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";
interface ICourseService {
  createCourse(data: CreateCourseDTO): Promise<CourseDTO>;
  getCourses(query: CourseQueryParams): Promise<PageableType<typeof CourseDTO>>;
  getCourseByID(id: number): Promise<CourseDTO | null>;
  importCoursesFromFile(file: File): Promise<void>;
}

export class CourseService implements ICourseService {
  constructor(
    private readonly courseRepository: ICourseRepository,
    private readonly courseFactory: ICourseFactory,
  ) {}

  async createCourse(data: CreateCourseDTO): Promise<CourseDTO> {
    const { preCoursesID, ...courseData } = data;

    const course = await this.courseRepository.createCourse(
      {
        ...courseData,
      },
      preCoursesID ?? [],
    );

    return this.courseFactory.mapCourseToDTO(course);
  }

  async getCourses(
    query: CourseQueryParams,
  ): Promise<PageableType<typeof CourseDTO>> {
    const [courses, total] = await Promise.all([
      this.courseRepository.getCoures(query),
      this.courseRepository.countCourse(query),
    ]);

    return {
      rows: this.courseFactory.mapCourseListToDTO(courses),
      totalRecords: total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  async getCourseByID(id: number): Promise<CourseDTO | null> {
    const course = await this.courseRepository.getCourseById(id);
    if (!course) {
      return null;
    }
    return this.courseFactory.mapCourseToDTO(course);
  }

  async updateCourse(
    courseId: number,
    data: UpdateCourseDTO,
  ): Promise<CourseDTO | null> {
    const { newPrecourseId, deletePrecourseId, ...courseData } = data;
    const course = await this.courseRepository.updateCourse(
      courseId,
      {
        ...courseData,
      },
      newPrecourseId ?? [],
      deletePrecourseId ?? [],
    );
    if (!course) return null;

    return this.courseFactory.mapCourseToDTO(course);
  }

  async deleteCourse(courseId: number): Promise<CourseDTO | null> {
    const course = await this.courseRepository.deleteCourse(courseId);
    if (!course) return null;

    return this.courseFactory.mapCourseToDTO(course);
  }

  async importCoursesFromFile(file: File): Promise<void> {
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith(".csv") || file.type === "text/csv";
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isCSV && !isExcel) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Invalid file format. Only CSV and Excel are allowed.",
        400,
      );
    }

    let rawRecords: Record<string, unknown>[];
    try {
      if (isCSV) {
        const text = await file.text();
        rawRecords = parse(text, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
        if (!sheet) {
          throw new Error("The spreadsheet has no readable worksheet.");
        }
        rawRecords = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          raw: false,
          defval: "",
        });
      }
    } catch {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "The uploaded file could not be read.",
        400,
      );
    }

    const records = rawRecords.map((row) => ({
      values: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key.trim(),
          String(value).trim(),
        ]),
      ),
    }));

    if (records.length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "File is empty or contains no valid data rows.",
        400,
      );
    }

    const validRecords: CourseCreatePayload[] = [];

    for (const { values } of records) {
      const parsedRow = {
        courseCode: values.courseCode,
        courseNameTh: values.courseNameTh,
        courseNameEn: values.courseNameEn,
        credits: values.credits,
        detail: values.detail,
        typeCourseID: values.typeCourseID
          ? Number(values.typeCourseID)
          : undefined,
        curriculumID: values.curriculumID
          ? Number(values.curriculumID)
          : undefined,
      };

      if (!Value.Check(CreateCourseDTO, parsedRow)) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "Invalid format", 400);
      }

      const course = {
        ...parsedRow,
      } as CourseCreatePayload;
      validRecords.push(course);
    }

    if (validRecords.length > 0) {
      await this.courseRepository.createManyCourses(validRecords);
    }
  }
}
