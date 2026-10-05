import { MasterDataDTO } from "./domain/master-data";
import { IMasterDataRepository } from "./domain/master-data.repository";
interface IMasterDataService {
  getMasterData(): Promise<MasterDataDTO>;
}

export class MasterDataService implements IMasterDataService {
  constructor(private readonly masterDataRepository: IMasterDataRepository) {}
  async getMasterData(): Promise<MasterDataDTO> {
    const [typeCourses, roles, tags, tagsGroups, prefixes, newsCategories] =
      await Promise.all([
        this.masterDataRepository.getTypeCourses(),
        this.masterDataRepository.getRoles(),
        this.masterDataRepository.getTags(),
        this.masterDataRepository.getTagGroup(),
        this.masterDataRepository.getPrefixes(),
        this.masterDataRepository.getNewsCategories(),
      ]);

    return {
      typeCourses,
      roles,
      tags,
      tagsGroups,
      prefixes,
      newsCategories,
    };
  }
}
