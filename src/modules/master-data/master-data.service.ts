import { MasterDataDTO } from "./domain/master-data";
import { IMasterDataRepository } from "./domain/master-data.repository";
interface IMasterDataService {
  getMasterData(): Promise<MasterDataDTO>;
}

export class MasterDataService implements IMasterDataService {
  constructor(private readonly masterDataRepository: IMasterDataRepository) {}
  async getMasterData(): Promise<MasterDataDTO> {
    const [typeCourses, roles, prefixes, newsCategories, fields, categories, projectTypes, techStacks] =
      await Promise.all([
        this.masterDataRepository.getTypeCourses(),
        this.masterDataRepository.getRoles(),
        this.masterDataRepository.getPrefixes(),
        this.masterDataRepository.getNewsCategories(),
        this.masterDataRepository.getFields(),
        this.masterDataRepository.getCategories(),
        this.masterDataRepository.getProjectTypes(),
        this.masterDataRepository.getTechStacks(),
      ]);

    return {
      typeCourses,
      roles,
      prefixes,
      newsCategories,
      fields,
      categories,
      projectTypes,
      techStacks,
    };
  }
}
