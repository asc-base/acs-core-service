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
  getStudentByUserIdIncludingDeleted(userId: number): Promise<Student | null>;
  restoreStudent(id: number, data: StudentCreatePayload): Promise<Student>;

  deleteStudent(id: number): Promise<Student>;
  updateStudent(
    studentID: number,
    data: StudentUpdatePayload,
  ): Promise<Student>;
  countStudents(query: StudentQueryParams): Promise<number>;
}
