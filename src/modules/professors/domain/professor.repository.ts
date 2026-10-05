import { Prisma } from "../../../generated/prisma/client";
import {
  Professor,
  ProfessorQueryParams,
  ProfessorCreatePayload,
  ProfessorUpdatePayload,
} from "./professor";

export interface IProfessorRepository {
  createProfessor(data: ProfessorCreatePayload): Promise<Professor>;
  getProfessors(query: ProfessorQueryParams): Promise<Professor[]>;
  getProfessorById(id: number): Promise<Professor | null>;
  getProfessorByUserId(userID: number): Promise<Professor | null>;
  updateProfessor(professorID: number,data: ProfessorUpdatePayload): Promise<Professor>;
  countProfessors(query: ProfessorQueryParams): Promise<number>;
  deleteProfessor(id: number): Promise<Professor | null>;
}
