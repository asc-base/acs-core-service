import {
  News,
  NewsDTO,
  NewsWithAdditionalImages,
  NewsWithAdditionalImageDTO,
} from "./domain/news";

export class NewsFactory {
  mapNewsToDTO(news: News): NewsDTO {
    return {
      id: news.id,
      title: news.title,
      thumbnailURL: news.thumbnail,
      highlightURL: news.images?.find((image) => image.imageType === "THUMBNAIL")?.imageUrl,
      detail: news.detail,
      startDate: news.startDate,
      dueDate: news.dueDate,
      thumbnailFocalPointX: news.thumbnailFocalPointX,
      thumbnailFocalPointY: news.thumbnailFocalPointY,
      cardFocalPointX: news.images?.find((image) => image.imageType === "CARD")?.focalPointX ?? news.thumbnailFocalPointX,
      cardFocalPointY: news.images?.find((image) => image.imageType === "CARD")?.focalPointY ?? news.thumbnailFocalPointY,
      category: news.category,
      images: news.images,
      eventStartAt: news.eventStartAt ?? news.startDate,
      eventEndAt: news.eventEndAt ?? news.dueDate,
    };
  }

  mapNewsListToDTO(newsList: News[]): NewsDTO[] {
    return newsList.map((news) => this.mapNewsToDTO(news));
  }

  mapNewsWithAdditionalImageToDTO(
    news: NewsWithAdditionalImages,
  ): NewsWithAdditionalImageDTO {
    const {newsAdditionalImages , ...Rest} = news;
    const mappedNews = this.mapNewsToDTO(Rest);
    const mappedNewsAdditionalImages = newsAdditionalImages.map((image) => ({ id: image.id, imageUrl: image.imageUrl, }));

    return {
  ...mappedNews,
  newsAdditionalImages: mappedNewsAdditionalImages,
};
  }
}
