import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as QRCode from 'qrcode';

@Injectable()
export class PdfService {
  async generateTicket(data: {
    pnr: string;
    passengerName: string;
    origin: string;
    destination: string;
    flightNumber: string;
    date: string;
    departureTime: string;
  }): Promise<Buffer> {
    try {
      const qrData = `PNR: ${data.pnr} | PAX: ${data.passengerName}`;
      const qrCodeBase64 = await QRCode.toDataURL(qrData, {
        margin: 1,
        width: 200,
        color: { dark: '#1a73e8', light: '#ffffff' },
      });


      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });


      const page = await browser.newPage();

      const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Inter', Arial, sans-serif; background-color: #f4f7f9; padding: 30px; }
          .ticket { 
            max-width: 800px; margin: 0 auto; background: white; border-radius: 20px; 
            overflow: hidden; box-shadow: 0 15px 35px rgba(0,0,0,0.1); display: flex;
          }
          .main-part { flex: 3; padding: 40px; border-right: 2px dashed #e0e0e0; position: relative; }
          .side-part { flex: 1; padding: 40px; background: #fafafa; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          
          /* Круглые вырезы по бокам (эффект билета) */
          .main-part::before, .main-part::after {
            content: ''; position: absolute; right: -15px; width: 30px; height: 30px; background: #f4f7f9; border-radius: 50%;
          }
          .main-part::before { top: -15px; }
          .main-part::after { bottom: -15px; }

          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
          .logo { font-size: 24px; font-weight: bold; color: #1a73e8; }
          .pnr { text-align: right; }
          .pnr-label { font-size: 12px; color: #70757a; }
          .pnr-value { font-size: 20px; font-weight: 800; color: #202124; }

          .route { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
          .airport { flex: 1; }
          .iata { font-size: 44px; font-weight: 900; color: #1a73e8; margin: 0; }
          .city { font-size: 14px; color: #70757a; }
          .plane { font-size: 24px; color: #dadce0; padding: 0 20px; }

          .details { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
          .item-label { font-size: 11px; color: #70757a; text-transform: uppercase; margin-bottom: 4px; }
          .item-value { font-size: 16px; font-weight: 600; }

          .qr-code { width: 140px; height: 140px; margin-bottom: 20px; }
          .passenger-name { font-size: 14px; font-weight: bold; text-align: center; color: #3c4043; }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="main-part">
            <div class="header">
              <div class="logo">SkyConnect Air</div>
              <div class="pnr">
                <div class="pnr-label">BOARDING PASS</div>
                <div class="pnr-value">${data.pnr}</div>
              </div>
            </div>

            <div class="route">
              <div class="airport">
                <p class="iata">${data.origin}</p>
                <p class="city">Departure</p>
              </div>
              <div class="plane">✈️</div>
              <div class="airport" style="text-align: right;">
                <p class="iata">${data.destination}</p>
                <p class="city">Arrival</p>
              </div>
            </div>

            <div class="details">
              <div>
                <div class="item-label">Passenger</div>
                <div class="item-value">${data.passengerName}</div>
              </div>
              <div>
                <div class="item-label">Flight</div>
                <div class="item-value">${data.flightNumber}</div>
              </div>
              <div>
                <div class="item-label">Date</div>
                <div class="item-value">${data.date}</div>
              </div>
              <div>
                <div class="item-label">Time</div>
                <div class="item-value">${data.departureTime}</div>
              </div>
            </div>
          </div>
          
          <div class="side-part">
            <img class="qr-code" src="${qrCodeBase64}" alt="QR Code" />
            <div class="passenger-name">${data.passengerName.split(' ')[1]}</div>
            <div style="font-size: 10px; color: #70757a; margin-top: 10px;">Scan at gate</div>
          </div>
        </div>
      </body>
      </html>
    `;

      await page.setContent(content);
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();
      return Buffer.from(pdf);
    } catch (e) {
      console.error('PDF GENERATION ERROR');
      console.error(e);
      throw e;
    }
  }
}
