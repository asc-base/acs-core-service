import { ICurriculumFactory } from "../curriculums/curriculum.factory";
import { ClassBook, ClassBookDTO } from "./domain/class-book";

export interface IClassBookFactory {
  mapClassBookToDTO(classBook: ClassBook): ClassBookDTO;
  mapClassBookListToDTO(classBooks: ClassBook[]): ClassBookDTO[];
}

export class ClassBookFactory implements IClassBookFactory {
  constructor(private readonly curriculumFactory: ICurriculumFactory) { }
  mapClassBookToDTO(classBook: ClassBook): ClassBookDTO {
    return {
      id: classBook.id,
      classof: classBook.classof,
      firstYearAcademic: classBook.firstYearAcademic,
      thumbnailURL: classBook.imageMedia?.imageUrl ?? classBook.thumbnailURL,
      thumbnailContentType: classBook.imageMedia?.contentType ?? null,
      imageFocalPointX: classBook.imageFocalPointX,
      imageFocalPointY: classBook.imageFocalPointY,
      curriculumID: classBook.curriculumID,
      curriculum: this.curriculumFactory.mapCurriculumToDTO(
        classBook.curriculum,
      ),
    };
  }

  mapClassBookListToDTO(classBooks: ClassBook[]): ClassBookDTO[] {
    return classBooks.map((classBook) => this.mapClassBookToDTO(classBook));
  }
}
