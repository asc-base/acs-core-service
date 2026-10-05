import { t, type TSchema, Static } from "elysia";
export interface BaseModel {
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export interface ResponseModel<T> {
  data: T;
  status: number;
  message?: string;
  err?: string;
}

export const BaseModelSchema = t.Object({
  createdAt: t.Optional(t.Date()),
  updatedAt: t.Optional(t.Date()),
  deletedAt: t.Optional(t.Nullable(t.Date())),
});

export const CommonQueryParams = {
  page: t.Optional(t.Numeric({ default: 1, minimum: 1, examples: [1] })),
  pageSize: t.Optional(t.Numeric({ default: 10, minimum: 1, examples: [10] })),
  orderBy: t.Optional(
    t.String({ default: "createdAt", examples: ["createdAt", "name"] }),
  ),
  sortBy: t.Optional(t.String({ default: "desc", examples: ["asc", "desc"] })),
};

// 1. ตัวนี้เป็น Schema Function (เอาไว้ใช้ใน response: ของ Elysia Router)
export const Pageable = <T extends TSchema>(schema: T) =>
  t.Object({
    rows: t.Array(schema),
    totalRecords: t.Number(),
    page: t.Number(),
    pageSize: t.Number(),
  });

// 2. ตัวนี้เป็น TypeScript Type (เอาไว้ใช้ใน Service หรือ Return Type ของฟังก์ชัน)
// ตั้งชื่อต่างกันนิดนึง (เช่น PageableType) เพื่อไม่ให้ชื่อชนกับ Function ด้านบนครับ
export type PageableType<T extends TSchema> = {
  rows: Static<T>[]; // ใช้ Static<T> เพื่อถอด Type ออกมาจาก Schema ที่โยนเข้ามา
  totalRecords: number;
  page: number;
  pageSize: number;
};
