import {
  News,
  NewsQueryParams,
  NewsFeature,
  QueryNewsFeatureParams,
  NewsCreatePayload,
  NewsFeatureUpsertPayload,
  NewsUpdatePayload,
  NewsWithAdditionalImages,
  NewsBulletinType,
  NewsBulletinView,
} from "./news";


export interface INewsRepository {
  createNews(data: NewsCreatePayload): Promise<NewsWithAdditionalImages>;
  getNews(query: NewsQueryParams): Promise<News[]>;
  getNewsById(id: number): Promise<NewsWithAdditionalImages | null>;
  createNewsFeature(
    newsFeatureData: NewsFeatureUpsertPayload,
  ): Promise<NewsFeature>;
  updateNewsFeature(
    id: number,
    newsFeatureData: NewsFeatureUpsertPayload,
  ): Promise<NewsFeature>;
  getNewsFeaturesBy(query: QueryNewsFeatureParams): Promise<NewsFeature[]>;
  getNewsFeatureById(id: number): Promise<NewsFeature | null>;
  countNews(query: NewsQueryParams): Promise<number>;
  countNewsFeatures(query: QueryNewsFeatureParams): Promise<number>;
  deleteNews(id: number): Promise<News | null>;
  updateNews(
    id: number,
    data: NewsUpdatePayload,
  ): Promise<NewsWithAdditionalImages>;
  getNewsBulletins(type: NewsBulletinType): Promise<NewsBulletinView[]>;
  setNewsBulletin(newsID: number, type: NewsBulletinType, enabled: boolean): Promise<NewsBulletinView | null>;
}
