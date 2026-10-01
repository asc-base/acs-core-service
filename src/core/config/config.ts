export interface Config {
  APP_PORT: number;
  SUPABASE_URL: string | null;
  SUPABASE_KEY: string | null;
  BUCKET_NAME: string;
  PROFILE_MEDIA_PROVIDER: string;
  RUSTFS_ENDPOINT: string | null;
  RUSTFS_REGION: string;
  RUSTFS_ACCESS_KEY_ID: string | null;
  RUSTFS_SECRET_ACCESS_KEY: string | null;
  RUSTFS_BUCKET: string | null;
  RUSTFS_PUBLIC_BASE_URL: string | null;
  HTTPONLY?: boolean;
  SECURE?: boolean;
  ENVIRONMENT: string;
  SECRET_JWT: string;
  APP_HOST: string;
  ALLOW_ORIGIN: string;
}

export const config: Config = {
  APP_PORT: process.env.APP_PORT
    ? Number.parseInt(process.env.APP_PORT, 10)
    : 8000,
  SUPABASE_URL: String(process.env.SUPABASE_URL),
  SUPABASE_KEY: String(process.env.SUPABASE_KEY),
  BUCKET_NAME: String(process.env.SUPABASE_BUCKET),
  PROFILE_MEDIA_PROVIDER: process.env.PROFILE_MEDIA_PROVIDER || "rustfs",
  RUSTFS_ENDPOINT: process.env.RUSTFS_ENDPOINT || null,
  RUSTFS_REGION: process.env.RUSTFS_REGION || "us-east-1",
  RUSTFS_ACCESS_KEY_ID: process.env.RUSTFS_ACCESS_KEY_ID || null,
  RUSTFS_SECRET_ACCESS_KEY: process.env.RUSTFS_SECRET_ACCESS_KEY || null,
  RUSTFS_BUCKET: process.env.RUSTFS_BUCKET || null,
  RUSTFS_PUBLIC_BASE_URL: process.env.RUSTFS_PUBLIC_BASE_URL || null,
  HTTPONLY: process.env.HTTPONLY === "true" || true,
  SECURE: process.env.SECURE === "true" || true,
  ENVIRONMENT: process.env.ENVIRONMENT || "development",
  SECRET_JWT: String(process.env.SECRET_JWT),
  APP_HOST: process.env.APP_HOST || "0,0,0,0",
  ALLOW_ORIGIN: process.env.ALLOW_ORIGIN || "*",
};
