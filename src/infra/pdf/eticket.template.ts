import type { EticketDocumentData } from './eticket.types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSegmentRows(segments: EticketDocumentData['segments']): string {
  return segments
    .map(
      (segment) => `
        <tr>
          <td>${escapeHtml(segment.itineraryLabel)}</td>
          <td>${escapeHtml(segment.flight)}</td>
          <td>${escapeHtml(segment.departureAirport)} → ${escapeHtml(segment.arrivalAirport)}</td>
          <td>${escapeHtml(segment.departureDate)}<br /><span class="muted">${escapeHtml(segment.departureTime)}</span></td>
          <td>${escapeHtml(segment.arrivalDate)}<br /><span class="muted">${escapeHtml(segment.arrivalTime)}</span></td>
          <td>${escapeHtml(segment.cabin)} (${escapeHtml(segment.bookingClass)})</td>
          <td>${escapeHtml(segment.fareBasis)}</td>
          <td>${escapeHtml(segment.seat)}</td>
          <td>${escapeHtml(segment.baggage)}</td>
        </tr>
      `,
    )
    .join('');
}

export function renderEticketHtml(data: EticketDocumentData, qrCodeBase64: string): string {
  const segmentRows = renderSegmentRows(data.segments);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
            background: #f3f4f6;
            margin: 0;
            padding: 24px;
          }
          .document {
            max-width: 920px;
            margin: 0 auto;
            background: #ffffff;
            border: 1px solid #d1d5db;
            border-radius: 12px;
            overflow: hidden;
          }
          .header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding: 28px 32px;
            border-bottom: 1px solid #e5e7eb;
            background: #f8fafc;
          }
          .brand {
            font-size: 24px;
            font-weight: 700;
            color: #1d4ed8;
          }
          .doc-title {
            font-size: 12px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #6b7280;
            margin-bottom: 4px;
          }
          .doc-value {
            font-size: 18px;
            font-weight: 700;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 16px;
            padding: 24px 32px;
            border-bottom: 1px solid #e5e7eb;
          }
          .label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #6b7280;
            margin-bottom: 4px;
          }
          .value {
            font-size: 15px;
            font-weight: 600;
          }
          .route {
            padding: 20px 32px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .route-code {
            font-size: 34px;
            font-weight: 800;
            color: #1d4ed8;
          }
          .section {
            padding: 24px 32px;
            border-bottom: 1px solid #e5e7eb;
          }
          .section-title {
            font-size: 14px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 16px;
            color: #374151;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 10px 8px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #f9fafb;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #4b5563;
          }
          .muted {
            color: #6b7280;
            font-size: 11px;
          }
          .fare-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px 24px;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            padding: 24px 32px;
            background: #f9fafb;
          }
          .notice {
            font-size: 11px;
            line-height: 1.5;
            color: #6b7280;
            max-width: 620px;
          }
          .qr {
            width: 120px;
            height: 120px;
          }
        </style>
      </head>
      <body>
        <div class="document">
          <div class="header">
            <div>
              <div class="brand">MaxAirline</div>
              <div class="muted">Electronic ticket / itinerary receipt</div>
            </div>
            <div>
              <div class="doc-title">Booking reference</div>
              <div class="doc-value">${escapeHtml(data.pnr)}</div>
            </div>
            <div>
              <div class="doc-title">Ticket number</div>
              <div class="doc-value">${escapeHtml(data.ticketNumber)}</div>
            </div>
            <div>
              <div class="doc-title">Issue date</div>
              <div class="doc-value">${escapeHtml(data.issuedAt)}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div>
              <div class="label">Passenger</div>
              <div class="value">${escapeHtml(data.passengerName)}</div>
            </div>
            <div>
              <div class="label">Passenger type</div>
              <div class="value">${escapeHtml(data.passengerType)}</div>
            </div>
            <div>
              <div class="label">Date of birth</div>
              <div class="value">${escapeHtml(data.dateOfBirth)}</div>
            </div>
            <div>
              <div class="label">Nationality</div>
              <div class="value">${escapeHtml(data.nationality)}</div>
            </div>
            <div>
              <div class="label">Passport</div>
              <div class="value">${escapeHtml(data.passportNumber)}</div>
            </div>
            <div>
              <div class="label">Booking total</div>
              <div class="value">${escapeHtml(data.bookingTotal)}</div>
            </div>
          </div>

          <div class="route">
            <div>
              <div class="label">Itinerary</div>
              <div class="route-code">${escapeHtml(data.origin)} → ${escapeHtml(data.destination)}</div>
            </div>
            <div class="muted">${data.segments.length} flight segment(s)</div>
          </div>

          <div class="section">
            <div class="section-title">Flight details</div>
            <table>
              <thead>
                <tr>
                  <th>Leg</th>
                  <th>Flight</th>
                  <th>Route</th>
                  <th>Departure</th>
                  <th>Arrival</th>
                  <th>Cabin</th>
                  <th>Fare basis</th>
                  <th>Seat</th>
                  <th>Baggage</th>
                </tr>
              </thead>
              <tbody>
                ${segmentRows}
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Fare breakdown (passenger)</div>
            <div class="fare-grid">
              <div>
                <div class="label">Base fare</div>
                <div class="value">${escapeHtml(data.fare.base)}</div>
              </div>
              <div>
                <div class="label">Taxes</div>
                <div class="value">${escapeHtml(data.fare.taxes)}</div>
              </div>
              <div>
                <div class="label">Fees</div>
                <div class="value">${escapeHtml(data.fare.fees)}</div>
              </div>
              <div>
                <div class="label">Seats</div>
                <div class="value">${escapeHtml(data.fare.seats)}</div>
              </div>
              <div>
                <div class="label">Passenger total</div>
                <div class="value">${escapeHtml(data.fare.total)}</div>
              </div>
            </div>
          </div>

          <div class="footer">
            <div class="notice">
              This document is your electronic ticket and itinerary receipt. Present the booking reference
              and ticket number at check-in. Arrive at the airport at least 2 hours before departure for
              international flights and 90 minutes for domestic flights. Carriage is subject to the
              operating carrier's conditions of contract.
            </div>
            <img class="qr" src="${qrCodeBase64}" alt="Ticket QR code" />
          </div>
        </div>
      </body>
    </html>
  `;
}

export function buildEticketQrPayload(data: EticketDocumentData): string {
  return [
    'ETKT',
    `PNR:${data.pnr}`,
    `TKT:${data.ticketNumber}`,
    `PAX:${data.passengerName}`,
    `ROUTE:${data.origin}-${data.destination}`,
  ].join('\n');
}
