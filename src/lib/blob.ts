import { put } from "@vercel/blob";

export interface PutBlobOptions {
  contentType?: string;
  addRandomSuffix?: boolean;
  allowOverwrite?: boolean;
}

/**
 * Robustly uploads a file to Vercel Blob, dynamically adapting to whether
 * the underlying Vercel Blob store is configured as "public" or "private".
 */
export async function putBlob(
  pathname: string,
  body: string | Blob | ArrayBuffer | Buffer | ReadableStream,
  options?: PutBlobOptions
) {
  const addRandomSuffix = options?.addRandomSuffix ?? false;
  const allowOverwrite = options?.allowOverwrite ?? true;
  const contentType = options?.contentType;

  try {
    // 1. Try public access (default for standard Vercel Blob stores)
    return await put(pathname, body, {
      access: "public",
      addRandomSuffix,
      allowOverwrite,
      ...(contentType ? { contentType } : {}),
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // If the store is explicitly configured for private access, retry with private
    if (
      errMsg.includes("Cannot use public access on a private store") ||
      errMsg.includes("must be configured with public access") ||
      errMsg.includes("private store")
    ) {
      return await put(pathname, body, {
        access: "private",
        addRandomSuffix,
        allowOverwrite,
        ...(contentType ? { contentType } : {}),
      });
    }
    throw err;
  }
}

