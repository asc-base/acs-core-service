import { IUserRepository } from "../../modules/users/domain/user.repository";
import { IProfessorRepository } from "../../modules/professors/domain/professor.repository";
import { IStudentRepository } from "../../modules/students/domain/student.repository";
import { IImageMediaRepository } from "../../modules/users/domain/image-media.repository";
import { IAuthRepository } from "../../modules/auth/domain/auth.repository";
import { IClassBookRepository } from "../../modules/class-book/domain/class-book.repository";

export interface IUnitOfWork {
  user: IUserRepository;
  professor: IProfessorRepository;
  student: IStudentRepository;
  imageMedia: IImageMediaRepository;
  auth: IAuthRepository;
  classBook: IClassBookRepository;

  commit(): Promise<void>;
  rollback(): Promise<void>;

  runInTransaction<T>(fn: (uow: IUnitOfWork) => Promise<T>): Promise<T>;
}
