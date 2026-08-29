import {
  supabaseStorageGet,
  supabaseStorageGetSignedUrl,
  supabaseStoragePut,
} from "./supabaseStorage";

/**
 * Cairn-owned private storage boundary.
 *
 * Keep callers independent from the storage provider: documents are stored in
 * a private Supabase Storage bucket and downloads use short-lived signed URLs.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  return supabaseStoragePut(relKey, data, contentType);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  return supabaseStorageGet(relKey);
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  return supabaseStorageGetSignedUrl(relKey);
}
