import { Curriculum, CurriculumDTO } from "./domain/curriculum";

export interface ICurriculumFactory {
  mapCurriculumToDTO(curriculum: Curriculum): CurriculumDTO;
  mapCurriculumsToDTOs(curriculums: Curriculum[]): CurriculumDTO[];
}
export class CurriculumFactory implements ICurriculumFactory {
  mapCurriculumToDTO(curriculum: Curriculum): CurriculumDTO {
    return {
      id: curriculum.id,
      title: curriculum.title,
      year: curriculum.year,
      description: curriculum.description,
      thumbnailURL: curriculum.imageMedia?.imageUrl ?? curriculum.thumbnailURL,
      thumbnailContentType: curriculum.imageMedia?.contentType ?? null,
      thumbnailFocalPointX: curriculum.thumbnailFocalPointX,
      thumbnailFocalPointY: curriculum.thumbnailFocalPointY,
      documentURL: curriculum.documentURL,
    };
  }

  mapCurriculumsToDTOs(curriculums: Curriculum[]): CurriculumDTO[] {
    return curriculums.map((curriculum) => this.mapCurriculumToDTO(curriculum));
  }
}
