import 'dotenv/config';

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let telemetrySdk: NodeSDK | null = null;

export function startTelemetry(): void {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  if (!endpoint) {
    return;
  }

  telemetrySdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  telemetrySdk.start();
}

export async function shutdownTelemetry(): Promise<void> {
  await telemetrySdk?.shutdown();
  telemetrySdk = null;
}
