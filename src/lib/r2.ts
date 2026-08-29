// Cloudflare R2 client — the "receiver isn't online right now" fallback
// path (Phase 2 of the plan). R2 was chosen specifically for its $0 egress
// fee: since this product is nothing but downloads, that's the single
// biggest lever on infra cost at scale (see the plan's cost estimate).
//
// R2 is S3-API-compatible, so the standard AWS SDK works unmodified against
// it — just point the endpoint at Cloudflare instead of AWS.
//
// Storage layout per shared link:
//   <token>       the file bytes, uploaded directly from the browser via a
//                 presigned PUT (bypasses our server entirely — we never
//                 touch the bytes, keeping our own bandwidth bill at zero
//                 for this path too).
//   <token>.json  a small sidecar with { name, size, mime, expiresAt },
//                 written by our server. Keeping metadata separate from the
//                 file object avoids the header-signature headaches of
//                 trying to attach custom metadata to a presigned PUT.
//
// Actual deletion of expired files is handled by an R2 bucket Object
// Lifecycle rule (a one-time dashboard/API setup step — see README), not by
// application code, so cleanup keeps working even if this app is offline.
import { S3Client, PutObjectCommand, GetObjectCommand, type S3ClientConfig } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME,
  );
}

let client: S3Client | null = null;

function r2Client(): S3Client {
  if (client) return client;
  const config: S3ClientConfig = {
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  };
  client = new S3Client(config);
  return client;
}

function bucket(): string {
  return process.env.R2_BUCKET_NAME!;
}

export interface UploadMeta {
  name: string;
  size: number;
  mime: string;
  expiresAt: number; // epoch ms
}

export async function writeMetadata(token: string, meta: UploadMeta): Promise<void> {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: `${token}.json`,
      Body: JSON.stringify(meta),
      ContentType: "application/json",
    }),
  );
}

export async function readMetadata(token: string): Promise<UploadMeta | null> {
  try {
    const res = await r2Client().send(new GetObjectCommand({ Bucket: bucket(), Key: `${token}.json` }));
    const text = await res.Body!.transformToString();
    return JSON.parse(text) as UploadMeta;
  } catch {
    return null;
  }
}

/** Presigned URL the browser PUTs the file to directly — the file bytes never pass through our server. */
export function getUploadUrl(token: string, expiresInSeconds = 60 * 60): Promise<string> {
  return getSignedUrl(r2Client(), new PutObjectCommand({ Bucket: bucket(), Key: token }), { expiresIn: expiresInSeconds });
}

/** Presigned URL the browser downloads from directly — regenerated fresh on each page load, not stored anywhere long-lived. */
export function getDownloadUrl(token: string, filename: string, expiresInSeconds = 5 * 60): Promise<string> {
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: token,
      // Forces a real download instead of the browser trying to render the file inline (images, PDFs, etc.).
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
    }),
    { expiresIn: expiresInSeconds },
  );
}
