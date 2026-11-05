import { Curriculum, CurriculumQueryParams, CurriculumCreatePayload, CurriculumUpdatePayload } from "./curriculum";

export interface ICurriculumRepository {
  createCurriculum(data: CurriculumCreatePayload): Promise<Curriculum>;
  getCurriculums(query: CurriculumQueryParams): Promise<Curriculum[]>;
  countCurriculums(query: CurriculumQueryParams): Promise<number>;
  getCurriculumById(id: number): Promise<Curriculum | null>;
  getCurriculumByYear(year: string): Promise<Curriculum | null>;
  updateCurriculum(id: number, data: CurriculumUpdatePayload): Promise<Curriculum>;
  deleteCurriculum(id: number): Promise<Curriculum>;
}
