import {
  Student,
  StudentQueryParams,
  StudentCreatePayload,
  StudentUpdatePayload,
} from "./student";

export interface IStudentRepository {
  createStudent(data: StudentCreatePayload): Promise<Student>;
  getStudents(query: StudentQueryParams): Promise<Student[]>;
  getStudentById(id: number): Promise<Student | null>;
  getStudentByUserId(userId: number): Promise<Student | null>;

  deleteStudent(id: number): Promise<Student>;
  deleteStudentsByClassBookID(classBookID: number): Promise<void>;
  updateStudent(
    studentID: number,
    data: StudentUpdatePayload,
  ): Promise<Student>;
  countStudents(query: StudentQueryParams): Promise<number>;
}
