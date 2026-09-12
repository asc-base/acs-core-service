import {
  News,
  NewsDTO,
  NewsFeatureDTO,
  NewsFeature,
  NewsWithAdditionalImages,
  NewsWithAdditionalImageDTO,
} from "./domain/news";

export class NewsFactory {
  mapNewsToDTO(news: News): NewsDTO {
    return {
      id: news.id,
      title: news.title,
      thumbnailURL: news.thumbnail,
      detail: news.detail,
      startDate: news.startDate,
      dueDate: news.dueDate,
      thumbnailFocalPointX: news.thumbnailFocalPointX,
      thumbnailFocalPointY: news.thumbnailFocalPointY,
      tag: news.tag
        ? {
          id: news.tag.id,
          name: news.tag.name,
          tagsGroupsId: news.tag.tagsGroupsId,
        }
        : undefined,
    };
  }

  mapNewsListToDTO(newsList: News[]): NewsDTO[] {
    return newsList.map((news) => this.mapNewsToDTO(news));
  }

  mapNewsFeatureToDTO(newsFeature: NewsFeature): NewsFeatureDTO {
    return {
      ...newsFeature,
      news: this.mapNewsToDTO(newsFeature.news),
    };
  }

  mapNewsFeatureListToDTO(newsFeatureList: NewsFeature[]): NewsFeatureDTO[] {
    return newsFeatureList.map((newsFeature) =>
      this.mapNewsFeatureToDTO(newsFeature),
    );
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
