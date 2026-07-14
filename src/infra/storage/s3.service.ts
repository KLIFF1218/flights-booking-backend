import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  S3ClientConfig,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from 'nestjs-pino';
import { S3UploadOptions } from './interfaces/s3-upload-options';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {
    const s3Bucket = this.config.getOrThrow<string>('S3_BUCKET');
    const s3Configuration: S3ClientConfig = {
      region: this.config.get<string>('S3_REGION', 'ru-central1'),
      endpoint: this.config.getOrThrow<string>('S3_ENDPOINT'),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_KEY'),
      },
      forcePathStyle: this.config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
    };

    this.bucket = s3Bucket;
    this.client = new S3Client(s3Configuration);
  }

  async uploadFile(options: S3UploadOptions): Promise<string> {
    const { key, body, contentType, cacheControl = 'max-age=31536000' } = options;

    try {
      this.logger.log({ msg: 'Starting S3 upload', key });

      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: cacheControl,
        } as PutObjectCommandInput,
        queueSize: 4,
        partSize: 5 * 1024 * 1024,
      });

      upload.on('httpUploadProgress', (progress) => {
        this.logger.debug({
          msg: 'Upload progress',
          key,
          loaded: progress.loaded,
          total: progress.total,
        });
      });

      await upload.done();

      this.logger.log({ msg: 'Successfully uploaded to S3', key });
      return key;
    } catch (error) {
      this.logger.error({
        msg: 'S3 upload failed',
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new InternalServerErrorException('File storage error');
    }
  }

  async getDownloadUrl(
    key: string,
    options?: {
      disposition?: 'inline' | 'attachment';
      fileName?: string;
      expiresIn?: number;
    },
  ): Promise<string> {
    const { disposition = 'inline', fileName, expiresIn = 3600 } = options || {};

    const finalFileName = fileName ?? key.split('/').pop() ?? 'ticket.pdf';

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `${disposition}; filename="${finalFileName}"; filename*=UTF-8''${encodeURIComponent(finalFileName)}`,
        ResponseContentType: 'application/pdf',
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      this.logger.error({
        msg: 'Presigned URL generation failed',
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new InternalServerErrorException('Link generation failed');
    }
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      return false;
    }
  }
}
