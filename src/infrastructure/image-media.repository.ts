import { PrismaInstance } from "../lib/db";
import { IImageMediaRepository } from "../modules/users/domain/image-media.repository";
import { ImageMedia, ImageMediaCreate } from "../modules/users/domain/image-media";

export class ImageMediaRepository implements IImageMediaRepository {
  constructor(private readonly db: PrismaInstance) {}

  async create(data: ImageMediaCreate): Promise<ImageMedia> {
    return (await this.db.imageMedia.create({ data })) as ImageMedia;
  }
}
