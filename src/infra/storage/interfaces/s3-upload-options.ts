export interface S3UploadOptions {
  key: string;
  body: Buffer | Uint8Array | ReadableStream | string;
  contentType: string;
  cacheControl?: string;
}
