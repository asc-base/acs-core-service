import { IUnitOfWork } from "../core/uow/uow.interface";
import { IUserRepository } from "../modules/users/domain/user.repository";
import { IProfessorRepository } from "../modules/professors/domain/professor.repository";
import { UserRepository } from "./user.repository";
import { PrismaClient } from "../generated/prisma/client";
import { ProfessorRepository } from "./profressor.repository";
import { IStudentRepository } from "../modules/students/domain/student.repository";
import { StudentRepository } from "./student.repository";
import { IImageMediaRepository } from "../modules/users/domain/image-media.repository";
import { ImageMediaRepository } from "./image-media.repository";
import { IAuthRepository } from "../modules/auth/domain/auth.repository";
import { AuthRepository } from "./auth.repository";

export class PrismaUnitOfWorkRepository implements IUnitOfWork {
  private _userRepository?: IUserRepository;
  private _professorRepository?: IProfessorRepository;
  private _studentRepository?: IStudentRepository;
  private _imageMediaRepository?: IImageMediaRepository;
  private _authRepository?: IAuthRepository;

  constructor(private readonly prisma: PrismaClient) {}
  get user(): IUserRepository {
    this._userRepository ??= new UserRepository(this.prisma);
    return this._userRepository;
  }

  get professor(): IProfessorRepository {
    this._professorRepository ??= new ProfessorRepository(this.prisma);
    return this._professorRepository;
  }

  get student(): IStudentRepository {
    this._studentRepository ??= new StudentRepository(this.prisma);
    return this._studentRepository;
  }

  get imageMedia(): IImageMediaRepository {
    this._imageMediaRepository ??= new ImageMediaRepository(this.prisma);
    return this._imageMediaRepository;
  }

  get auth(): IAuthRepository {
    this._authRepository ??= new AuthRepository(this.prisma);
    return this._authRepository;
  }

  async runInTransaction<T>(fn: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const transactionUow = new PrismaUnitOfWorkRepository(tx as PrismaClient);
      return await fn(transactionUow);
    });
  }

  async commit(): Promise<void> {
    // No-op: Prisma handles commit automatically in $transaction
  }

  async rollback(): Promise<void> {
    // No-op: Prisma handles rollback automatically in $transaction
  }
}
