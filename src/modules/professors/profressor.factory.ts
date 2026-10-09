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
      ...this.userFactory.mapUserToDTO(professor.user),
      professor: {
        id: professor.id,
        profRoom: professor.profRoom,
        phone: professor.phone,
        research_profile: professor.researchProfile ?? null,
        expertFields: professor.expertFields
          ? professor.expertFields.split("/").map((field) => field.trim()).filter((field) => field.length > 0)
          : [],
        educations: (professor.educations ?? []).map(({ education }) => education),
      },
    };
  }

  mapPrfessorListToDTO(professors: Professor[]): ProfessorDTO[] {
    return professors.map((professor) => this.mapProfessorToDTO(professor));
  }
}
