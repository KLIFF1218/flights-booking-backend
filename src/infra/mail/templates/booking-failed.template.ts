export const renderBookingFailedEmail = (bookingId: string): string => {
  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif; color: #111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 24px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            <tr>
              <td style="background-color: #dc2626; color: #ffffff; padding: 24px; font-size: 22px; font-weight: bold;">
                Booking processing failed
              </td>
            </tr>
            <tr>
              <td style="padding: 24px;">
                <p style="margin: 0 0 16px;">We were unable to complete ticketing for booking <strong>${bookingId}</strong>.</p>
                <p style="margin: 0 0 16px;">If payment was captured, our support team will review your booking and contact you shortly.</p>
                <p style="margin: 0; color: #6b7280; font-size: 14px;">We apologize for the inconvenience.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};
