import { MasterDataDTO } from "./domain/master-data";
import { IMasterDataRepository } from "./domain/master-data.repository";
interface IMasterDataService {
  getMasterData(): Promise<MasterDataDTO>;
}

export class MasterDataService implements IMasterDataService {
  constructor(private readonly masterDataRepository: IMasterDataRepository) {}
  async getMasterData(): Promise<MasterDataDTO> {
    const [typeCourses, roles, tags, tagsGroups, prefixes, newsCategories, fields, categories, projectTypes] =
      await Promise.all([
        this.masterDataRepository.getTypeCourses(),
        this.masterDataRepository.getRoles(),
        this.masterDataRepository.getTags(),
        this.masterDataRepository.getTagGroup(),
        this.masterDataRepository.getPrefixes(),
        this.masterDataRepository.getNewsCategories(),
        this.masterDataRepository.getFields(),
        this.masterDataRepository.getCategories(),
        this.masterDataRepository.getProjectTypes(),
        this.masterDataRepository.getFields(),
        this.masterDataRepository.getCategories(),
        this.masterDataRepository.getProjectTypes(),
      ]);

    return {
      typeCourses,
      roles,
      tags,
      tagsGroups,
      prefixes,
      newsCategories,
      fields,
      categories,
      projectTypes,
    };
  }
}
