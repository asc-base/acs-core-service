import { promises } from "node:dns";
import {
  News,
  NewsQueryParams,
  NewsFeature,
  QueryNewsFeatureParams,
  NewsCreatePayload,
  NewsFeatureUpsertPayload,
  NewsUpdatePayload,
  NewsAdditionalImage,
  NewsAdditionalImageCreatePayload,
  NewsWithAdditionalImages,
} from "./news";


export interface INewsRepository {
  createNews(data: NewsCreatePayload): Promise<News>;
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
  ): Promise<News>;
  createNewsAdditionalImages(
    data: NewsAdditionalImageCreatePayload[],
  ): Promise<NewsAdditionalImage[]>;
  getNewsAdditionalImagesByNewsId(newsID: number): Promise<NewsAdditionalImage[]>;
  deleteNewsAdditionalImages(data : number[]): Promise<NewsAdditionalImage[]>;
}