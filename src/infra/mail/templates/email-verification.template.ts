export const renderEmailVerificationEmail = (verifyUrl: string): string => {
  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif; color: #111827;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 24px 0;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            <tr>
              <td style="background-color: #0f766e; color: #ffffff; padding: 24px; font-size: 22px; font-weight: bold;">
                Verify your email
              </td>
            </tr>
            <tr>
              <td style="padding: 24px;">
                <p style="margin: 0 0 16px;">Confirm your email address to unlock payments and account recovery.</p>
                <p style="margin: 0 0 24px;">
                  <a href="${verifyUrl}" style="display: inline-block; background-color: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold;">
                    Verify email
                  </a>
                </p>
                <p style="margin: 0; color: #6b7280; font-size: 13px; word-break: break-all;">Or open this link: ${verifyUrl}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};
