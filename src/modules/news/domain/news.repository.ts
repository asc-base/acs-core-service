import {
  News,
  NewsQueryParams,
  NewsCreatePayload,
  NewsUpdatePayload,
  NewsWithAdditionalImages,
  NewsBulletinType,
  NewsBulletinView,
} from "./news";


export interface INewsRepository {
  createNews(data: NewsCreatePayload): Promise<NewsWithAdditionalImages>;
  getNews(query: NewsQueryParams): Promise<News[]>;
  getNewsById(id: number): Promise<NewsWithAdditionalImages | null>;
  countNews(query: NewsQueryParams): Promise<number>;
  deleteNews(id: number): Promise<News | null>;
  updateNews(
    id: number,
    data: NewsUpdatePayload,
  ): Promise<NewsWithAdditionalImages>;
  getNewsBulletins(type: NewsBulletinType): Promise<NewsBulletinView[]>;
  setNewsBulletin(newsID: number, type: NewsBulletinType, enabled: boolean): Promise<NewsBulletinView | null>;
}
