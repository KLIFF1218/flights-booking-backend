import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as QRCode from 'qrcode';
import { Logger } from 'nestjs-pino';
import type { EticketDocumentData } from './eticket.types';
import { buildEticketQrPayload, renderEticketHtml } from './eticket.template';

@Injectable()
export class PdfService {
  constructor(private readonly logger: Logger) {}

  async generateEticket(data: EticketDocumentData): Promise<Buffer> {
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;

    try {
      const qrCodeBase64 = await QRCode.toDataURL(buildEticketQrPayload(data), {
        margin: 1,
        width: 220,
        color: { dark: '#1d4ed8', light: '#ffffff' },
      });

      browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      const page = await browser.newPage();
      await page.setContent(renderEticketHtml(data, qrCodeBase64), {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });

      return Buffer.from(pdf);
    } catch (error: unknown) {
      this.logger.error(
        { err: error instanceof Error ? error : String(error) },
        'E-ticket PDF generation failed',
      );
      throw error;
    } finally {
      await browser?.close();
    }
  }

  /** @deprecated Use generateEticket instead. */
  async generateTicket(data: {
    pnr: string;
    passengerName: string;
    origin: string;
    destination: string;
    flightNumber: string;
    date: string;
    departureTime: string;
  }): Promise<Buffer> {
    return this.generateEticket({
      pnr: data.pnr,
      ticketNumber: '000-0000000000',
      issuedAt: data.date,
      passengerName: data.passengerName,
      passengerType: 'Adult',
      dateOfBirth: '—',
      nationality: '—',
      passportNumber: '—',
      origin: data.origin,
      destination: data.destination,
      segments: [
        {
          itineraryLabel: 'Flight',
          flight: data.flightNumber,
          departureAirport: data.origin,
          arrivalAirport: data.destination,
          departureDate: data.date,
          departureTime: data.departureTime,
          arrivalDate: data.date,
          arrivalTime: '—',
          cabin: 'Economy',
          bookingClass: 'Y',
          fareBasis: '—',
          seat: 'Not assigned',
          baggage: '—',
        },
      ],
      fare: {
        base: '0.00 USD',
        taxes: '0.00 USD',
        fees: '0.00 USD',
        seats: '0.00 USD',
        total: '0.00 USD',
        currency: 'USD',
      },
      bookingTotal: '0.00 USD',
      bookingCurrency: 'USD',
    });
  }
}
