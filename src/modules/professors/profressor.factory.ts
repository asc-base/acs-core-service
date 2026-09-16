import { ProfessorDTO, Professor } from "./domain/professor";
import { IUserFactory } from "../users/user.factory";

export interface IProfessorFactory {
  mapProfessorToDTO(professor: Professor): ProfessorDTO;
  mapPrfessorListToDTO(professors: Professor[]): ProfessorDTO[];
}

export class ProfessorFactory implements IProfessorFactory {
  constructor(private readonly userFactory: IUserFactory) { }
  mapProfessorToDTO(professor: Professor): ProfessorDTO {
    return {
      id: professor.id,
      profRoom: professor.profRoom,
      prefix: professor.user.prefix,
      user: this.userFactory.mapUserToDTO(professor.user),
      phone: professor.phone,
      expertFields: professor.expertFields
        ? professor.expertFields?.split("/").map((field) => field.trim()).filter((field) => field.length > 0)
        : [],
      educations: professor.educations
        ? professor.educations?.split("/").map((edu) => edu.trim()).filter((edu) => edu.length > 0)
        : [],
    };
  }

  mapPrfessorListToDTO(professors: Professor[]): ProfessorDTO[] {
    return professors.map((professor) => this.mapProfessorToDTO(professor));
  }
}
