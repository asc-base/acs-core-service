import { IUserRepository } from "../../modules/users/domain/user.repository";
import { IProfessorRepository } from "../../modules/professors/domain/professor.repository";
import { IStudentRepository } from "../../modules/students/domain/student.repository";
import { IImageMediaRepository } from "../../modules/users/domain/image-media.repository";
import { IAuthRepository } from "../../modules/auth/domain/auth.repository";

export interface IUnitOfWork {
  user: IUserRepository;
  professor: IProfessorRepository;
  student: IStudentRepository;
  imageMedia: IImageMediaRepository;
  auth: IAuthRepository;

  commit(): Promise<void>;
  rollback(): Promise<void>;

  runInTransaction<T>(fn: (uow: IUnitOfWork) => Promise<T>): Promise<T>;
}
