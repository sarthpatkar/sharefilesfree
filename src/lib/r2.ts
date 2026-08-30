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
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sanitizeFilename } from "@/lib/sanitize";

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
  blocked?: boolean; // set by the abuse-report flow — see /api/report/[token]
  passwordHash?: string; // hex — see hashPassword/verifyPassword
  passwordSalt?: string; // hex
  burnAfterDownload?: boolean; // "delete after first download" — see markDownloaded
}

/** scrypt with a per-file random salt — no extra dependency, adequate for gating a casual share link (not a high-value secret store). */
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
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

/**
 * Immediately disables a shared link's download. We deliberately don't wait for human
 * review before taking effect — for an anonymous, no-login product, a fast/automatic
 * takedown on the first report matters more than protecting against the rare bad-faith
 * report, especially since reporting requires already having the (unguessable) token,
 * the same bar as downloading it. This is the safeguard the plan calls out as
 * non-negotiable from day one (see the Firefox Send case study).
 */
export async function markReported(token: string): Promise<boolean> {
  const meta = await readMetadata(token);
  if (!meta) return false;
  await writeMetadata(token, { ...meta, blocked: true });
  return true;
}

/**
 * Marks a "delete after first download" link as consumed. Fires the moment a download
 * URL is handed out, not after the transfer actually completes — we have no way to
 * observe a direct browser-to-R2 download finishing, so "opened the link" is the
 * closest honest approximation of "downloaded" available without proxying bytes
 * through our own server (which would undo R2's zero-egress benefit).
 */
export async function markDownloaded(token: string): Promise<void> {
  const meta = await readMetadata(token);
  if (meta) await writeMetadata(token, { ...meta, blocked: true });
}

/** Presigned URL the browser PUTs the file to directly — the file bytes never pass through our server. */
export function getUploadUrl(token: string, expiresInSeconds = 60 * 60): Promise<string> {
  return getSignedUrl(r2Client(), new PutObjectCommand({ Bucket: bucket(), Key: token }), { expiresIn: expiresInSeconds });
}

// --- Multipart upload (resumable-within-session large uploads) ---
// R2 is S3-API-compatible, so the standard multipart flow applies unmodified:
// create an upload, get a presigned URL per part, PUT each part directly from
// the browser, then complete with the collected ETags. This is what makes a
// dropped connection on a multi-GB file recoverable — only the failed part
// needs retrying, not the whole upload. Scope note: this recovers from a
// mid-session network blip (the common case), not a fully closed tab days
// later, since that would need re-selecting the same File from disk and
// persisting the upload ID — a materially bigger feature, not attempted here.

/** S3/R2 requires every part except the last to be at least 5MB. */
export const MULTIPART_PART_SIZE = 8 * 1024 * 1024;
/** Below this, a single presigned PUT is simpler and just as fast. */
export const MULTIPART_THRESHOLD = 10 * 1024 * 1024;

export async function createMultipartUpload(token: string): Promise<string> {
  const res = await r2Client().send(new CreateMultipartUploadCommand({ Bucket: bucket(), Key: token }));
  if (!res.UploadId) throw new Error("R2 didn't return an upload ID.");
  return res.UploadId;
}

export function getPartUploadUrl(token: string, uploadId: string, partNumber: number, expiresInSeconds = 60 * 60): Promise<string> {
  return getSignedUrl(
    r2Client(),
    new UploadPartCommand({ Bucket: bucket(), Key: token, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: expiresInSeconds },
  );
}

export async function completeMultipartUpload(token: string, uploadId: string, parts: { partNumber: number; etag: string }[]): Promise<void> {
  await r2Client().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: token,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
    }),
  );
}

export async function abortMultipartUpload(token: string, uploadId: string): Promise<void> {
  await r2Client()
    .send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: token, UploadId: uploadId }))
    .catch(() => {
      // Best-effort cleanup — an orphaned incomplete multipart upload costs a
      // little storage until the bucket's lifecycle rule sweeps it, not worth
      // failing the user-facing request over.
    });
}

/** Presigned URL the browser downloads from directly — regenerated fresh on each page load, not stored anywhere long-lived. */
export function getDownloadUrl(token: string, filename: string, expiresInSeconds = 5 * 60): Promise<string> {
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: token,
      // Forces a real download instead of the browser trying to render the file inline (images, PDFs, etc.).
      // Sanitized again here (defense-in-depth) even though upload-url already cleans the name on the way in —
      // this is the actual HTTP header value, so nothing reaches it unsanitized regardless of call site.
      ResponseContentDisposition: `attachment; filename="${sanitizeFilename(filename)}"`,
    }),
    { expiresIn: expiresInSeconds },
  );
}
