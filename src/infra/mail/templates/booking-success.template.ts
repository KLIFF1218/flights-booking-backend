type TicketInfo = {
  ticketNumber: string;
  downloadUrl: string;
};

export const renderBookingSuccessEmail = (bookingId: string, tickets: TicketInfo[]): string => {
  const ticketRows = tickets
    .map(
      (ticket) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${ticket.ticketNumber}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">
            <a href="${ticket.downloadUrl}" style="color: #2563eb;">Download PDF</a>
          </td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif; color: #111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 24px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            <tr>
              <td style="background-color: #1d4ed8; color: #ffffff; padding: 24px; font-size: 22px; font-weight: bold;">
                Your e-ticket is ready
              </td>
            </tr>
            <tr>
              <td style="padding: 24px;">
                <p style="margin: 0 0 16px;">Your booking <strong>${bookingId}</strong> has been confirmed.</p>
                <p style="margin: 0 0 16px;">Your e-tickets are attached to this email. You can also download them using the links below:</p>
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 16px;">
                  <tr>
                    <th align="left" style="padding: 8px 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">Ticket</th>
                    <th align="left" style="padding: 8px 12px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">Link</th>
                  </tr>
                  ${ticketRows}
                </table>
                <p style="margin: 24px 0 0; color: #6b7280; font-size: 14px;">Have a pleasant flight!</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};
