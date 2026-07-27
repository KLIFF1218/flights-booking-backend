import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';

export interface IntegrationInfraConfig {
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  redisPassword: string;
  rabbitmqUri: string;
  s3Endpoint: string;
}

export function loadIntegrationEnv(): void {
  dotenv.config({ path: resolve(__dirname, '../../.env'), override: true });
}

export function resolveComposeInfra(): IntegrationInfraConfig {
  const databaseUrl = process.env.DATABASE_URL;
  const redisHost = process.env.REDIS_HOST ?? 'localhost';
  const redisPort = Number(process.env.REDIS_PORT ?? 6379);
  const redisPassword = process.env.REDIS_PASSWORD ?? '';
  const rabbitmqUri = process.env.RABBITMQ_URI;
  const s3Endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';

  const missing: string[] = [];
  if (!databaseUrl) missing.push('DATABASE_URL');
  if (!rabbitmqUri) missing.push('RABBITMQ_URI');

  if (missing.length > 0) {
    throw new Error(
      `Integration test requires ${missing.join(', ')} in .env. ` +
        'Run: cp .env.example .env && docker compose up -d postgres redis rabbitmq minio',
    );
  }

  return {
    databaseUrl,
    redisHost,
    redisPort,
    redisPassword,
    rabbitmqUri,
    s3Endpoint,
  };
}

export async function ensureMinioBucket(endpoint: string, bucket = 'my-tickets'): Promise<void> {
  const client = new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'minio',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'minio123',
    },
    forcePathStyle: true,
  });

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch {
    // Bucket may already exist.
  } finally {
    client.destroy();
  }
}
