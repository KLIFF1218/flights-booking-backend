import { Injectable } from '@nestjs/common';
import { PdfService } from 'src/infra/pdf/pdf.service';
import { S3Service } from 'src/infra/storage/s3.service';
import type { EticketDocumentData } from 'src/infra/pdf/eticket.types';

@Injectable()
export class TicketDocumentService {
  constructor(
    private readonly pdfService: PdfService,
    private readonly s3: S3Service,
  ) {}

  buildTicketPdfKey(bookingId: string, travelerId: string): string {
    return `tickets/${bookingId}/${travelerId}.pdf`;
  }

  async generatePdf(documentData: EticketDocumentData): Promise<Buffer> {
    return this.pdfService.generateEticket(documentData);
  }

  async uploadPdf(fileKey: string, pdfBuffer: Buffer): Promise<void> {
    await this.s3.uploadFile({
      key: fileKey,
      body: pdfBuffer,
      contentType: 'application/pdf',
    });
  }
}
