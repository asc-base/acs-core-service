import { ImageMedia, ImageMediaCreate } from "./image-media";

export interface IImageMediaRepository {
  create(data: ImageMediaCreate): Promise<ImageMedia>;
}
