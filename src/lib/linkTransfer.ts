// Client-side half of the "receiver isn't online right now" fallback: ask
// our API for a presigned upload URL, then PUT the file straight to R2.
// XMLHttpRequest (not fetch) is used deliberately — it's the only browser
// API that exposes upload progress events.

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

export async function uploadFileForLink(
  file: File,
  onProgress?: (p: UploadProgress) => void,
  options: LinkUploadOptions = {},
): Promise<LinkUploadResult> {
  const res = await fetch("/api/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      mime: file.type,
      password: options.password || undefined,
      expiryHours: options.expiryHours,
      burnAfterDownload: options.burnAfterDownload,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string });
    throw new Error(body.error || "Could not start the upload.");
  }
  const { token, uploadUrl, expiresAt } = (await res.json()) as { token: string; uploadUrl: string; expiresAt: number };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.({ loaded: e.loaded, total: e.total });
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (status ${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection and try again."));
    xhr.send(file);
  });

  return { token, expiresAt };
}
