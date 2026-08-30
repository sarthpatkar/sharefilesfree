// Client-side half of the "receiver isn't online right now" fallback.
// Small files: a single presigned PUT. Large files (see MULTIPART_THRESHOLD
// server-side): split into parts, each uploaded independently with its own
// retry — a dropped connection mid-upload only costs the one failed part,
// not the whole file. XMLHttpRequest (not fetch) throughout because it's
// the only browser API that exposes upload progress events.

export interface UploadProgress {
  loaded: number;
  total: number;
}

export interface LinkUploadResult {
  token: string;
  expiresAt: number;
}

export interface LinkUploadOptions {
  password?: string;
  expiryHours?: number;
  burnAfterDownload?: boolean;
}

const MAX_PART_RETRIES = 4;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const parsed = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(parsed.error || "Request failed.");
  return parsed as T;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function putWithProgress(url: string, body: Blob, onProgress: (loaded: number) => void): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(xhr) : reject(new Error(`Upload failed (status ${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(body);
  });
}

async function uploadSinglePart(file: File, uploadUrl: string, onProgress?: (p: UploadProgress) => void) {
  await putWithProgress(uploadUrl, file, (loaded) => onProgress?.({ loaded, total: file.size }));
}

async function uploadMultipart(
  file: File,
  token: string,
  uploadId: string,
  partSize: number,
  totalParts: number,
  onProgress?: (p: UploadProgress) => void,
) {
  const parts: { partNumber: number; etag: string }[] = [];
  let completedBytes = 0;

  try {
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * partSize;
      const chunk = file.slice(start, Math.min(start + partSize, file.size));

      let lastError: Error | null = null;
      let etag: string | null = null;
      for (let attempt = 0; attempt < MAX_PART_RETRIES && !etag; attempt++) {
        if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1)); // exponential backoff: 1s, 2s, 4s
        try {
          const { url } = await postJson<{ url: string }>("/api/upload-part-url", { token, uploadId, partNumber });
          const xhr = await putWithProgress(url, chunk, (loaded) => onProgress?.({ loaded: completedBytes + loaded, total: file.size }));
          etag = xhr.getResponseHeader("ETag");
          if (!etag) throw new Error("Upload succeeded but the server didn't return a confirmation — check the R2 bucket's CORS settings (ETag must be an exposed header).");
        } catch (e) {
          lastError = e as Error;
        }
      }
      if (!etag) throw lastError || new Error(`Part ${partNumber} failed after ${MAX_PART_RETRIES} attempts.`);

      completedBytes += chunk.size;
      onProgress?.({ loaded: completedBytes, total: file.size });
      parts.push({ partNumber, etag });
    }

    await postJson("/api/upload-complete", { token, uploadId, parts });
  } catch (e) {
    // Best-effort — don't let a cleanup failure mask the real error.
    postJson("/api/upload-abort", { token, uploadId }).catch(() => {});
    throw e;
  }
}

export async function uploadFileForLink(file: File, onProgress?: (p: UploadProgress) => void, options: LinkUploadOptions = {}): Promise<LinkUploadResult> {
  const start = await postJson<{
    token: string;
    expiresAt: number;
    mode: "single" | "multipart";
    uploadUrl?: string;
    uploadId?: string;
    partSize?: number;
    totalParts?: number;
  }>("/api/upload-url", {
    name: file.name,
    size: file.size,
    mime: file.type,
    password: options.password || undefined,
    expiryHours: options.expiryHours,
    burnAfterDownload: options.burnAfterDownload,
  });

  if (start.mode === "multipart") {
    await uploadMultipart(file, start.token, start.uploadId!, start.partSize!, start.totalParts!, onProgress);
  } else {
    await uploadSinglePart(file, start.uploadUrl!, onProgress);
  }

  return { token: start.token, expiresAt: start.expiresAt };
}
