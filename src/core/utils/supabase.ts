import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config/config.js";
import { randomUUID } from "node:crypto";

export class SupabaseService {
  public client: SupabaseClient;
  private readonly bucketName: string;

  constructor() {
    // ตรวจสอบ Environment Variables
    const supabaseUrl = config.SUPABASE_URL;
    const supabaseKey = config.SUPABASE_KEY;
    const bucketNmae = config.BUCKET_NAME;

    if (!supabaseUrl || !supabaseKey || !bucketNmae || bucketNmae === "undefined") {
      throw new Error("Supabase URL, key, and bucket are required");
    }

    this.bucketName = bucketNmae;

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, // Server-side ไม่ต้องจำ Session
      },
    });
  }

  async uploadFile(file: File, folder: string = "uploads") {
    const timestamp = Date.now();
    const path = `${folder}/${timestamp}-${file.name}`;

    const { error } = await this.client.storage
      .from(this.bucketName)
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: publicUrlData } = this.client.storage
      .from(this.bucketName)
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  }

  async uploadFileWithMetadata(
    file: File,
    folder: string,
    contentType = file.type,
  ) {
    if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(folder)) {
      throw new Error("Invalid Supabase folder");
    }
    const path = `${folder}/${randomUUID()}`;

    const { error } = await this.client.storage
      .from(this.bucketName)
      .upload(path, file, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    const { data: publicUrlData } = this.client.storage
      .from(this.bucketName)
      .getPublicUrl(path);

    return {
      bucket: this.bucketName,
      fileKey: path,
      imageUrl: publicUrlData.publicUrl,
    };
  }

  // --- Helper Methods (ตัวอย่าง: การลบไฟล์) ---
  async deleteFile(path: string) {
    const { error } = await this.client.storage
      .from(this.bucketName)
      .remove([path]);

    if (error) throw new Error(error.message);
  }
}
