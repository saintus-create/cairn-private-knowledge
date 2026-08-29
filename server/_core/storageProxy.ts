import type { Express } from "express";
import { supabaseStorageGetSignedUrl } from "../supabaseStorage";

/**
 * Compatibility route for older clients that still request /manus-storage/*.
 * The route name is retained for backwards compatibility, but the backing
 * store is now Cairn's private Supabase Storage bucket.
 */
export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    try {
      const signedUrl = await supabaseStorageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, signedUrl);
    } catch (error) {
      console.error("[StorageProxy] Supabase Storage error:", error);
      res.status(404).send("Stored object not found");
    }
  });
}
