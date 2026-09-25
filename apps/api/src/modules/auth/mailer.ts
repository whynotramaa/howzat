import { Resend } from 'resend';
import { emailEnabled, env } from '../../config/env';
import { logger } from '../../lib/logger';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  if (!resend || !emailEnabled) {
    logger.info(
      { email, code, ttlMinutes: env.OTP_TTL_MINUTES },
      `Verification code for ${email}: ${code}  (email sending disabled — set RESEND_API_KEY to send for real)`,
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: env.OTP_FROM_EMAIL,
    to: email,
    subject: `${code} is your Howzat verification code`,
    text: `Your Howzat verification code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes.\n\nIf you didn't create a Howzat account, you can ignore this email.`,
    html: otpEmailHtml(code),
  });

  if (error) {
    logger.error({ err: error, email }, 'Resend failed to send the verification code');
    throw new Error('Could not send the verification code');
  }
}

export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  if (!resend || !emailEnabled) {
    logger.info(
      { email, code, ttlMinutes: env.OTP_TTL_MINUTES },
      `Password reset code for ${email}: ${code}  (email sending disabled — set RESEND_API_KEY to send for real)`,
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: env.OTP_FROM_EMAIL,
    to: email,
    subject: `${code} is your Howzat password reset code`,
    text: `Someone asked to reset the password for your Howzat account. Your code is ${code}. It expires in ${env.OTP_TTL_MINUTES} minutes.\n\nIf that wasn't you, ignore this email — your password has not changed.`,
    html: otpEmailHtml(code, {
      heading: 'Reset your password',
      lead: `Someone asked to reset the password for your Howzat account. Enter this code to choose a new one. It expires in ${env.OTP_TTL_MINUTES} minutes.`,
      footer: "If that wasn't you, ignore this email — your password has not changed.",
    }),
  });

  if (error) {
    logger.error({ err: error, email }, 'Resend failed to send the password reset code');
    throw new Error('Could not send the password reset code');
  }
}

interface SquadAdditionEmail {
  to: string;
  name: string;
  teamName: string;
  tournamentName: string;
  organizerName: string;
  dashboardUrl: string;
}

export async function sendSquadAdditionEmail(input: SquadAdditionEmail): Promise<void> {
  const subject = `You've been added to ${input.teamName}`;
  const lead =
    `${input.organizerName} added you to ${input.teamName} in ${input.tournamentName}. ` +
    `Your fixtures and the live scores are on your Howzat dashboard.`;

  if (!resend || !emailEnabled) {
    logger.info(
      { to: input.to, team: input.teamName, tournament: input.tournamentName },
      `Squad notification for ${input.to}: ${subject}  (email sending disabled — set RESEND_API_KEY to send for real)`,
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: env.OTP_FROM_EMAIL,
    to: input.to,
    subject,
    text: `Hey ${input.name}, you have been added to this tournament!\n\n${lead}\n\nOpen your dashboard: ${input.dashboardUrl}`,
    html: squadAdditionHtml(input, subject, lead),
  });

  if (error) {
    logger.error({ err: error, to: input.to }, 'Resend failed to send the squad notification');
    throw new Error('Could not send the squad notification');
  }
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function shell(body: string): string {
  return `<!doctype html>
<html>
  <head><meta name="color-scheme" content="light"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:${FONT};color:#000000;-webkit-font-smoothing:antialiased">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff">
      <tr>
        <td align="center" style="padding:40px 20px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border:1px solid #eaeaea;border-radius:8px;padding:40px">
            <tr>
              <td>
                <p style="margin:0 0 32px;font-size:15px;font-weight:600;letter-spacing:-.01em;color:#000000">Howzat</p>
${body}
              </td>
            </tr>
          </table>
          <p style="max-width:560px;margin:24px auto 0;font-size:12px;line-height:1.5;color:#8f8f8f;text-align:center">
            Howzat &middot; sent from otp@ramaa.tech
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function squadAdditionHtml(input: SquadAdditionEmail, heading: string, lead: string): string {
  return shell(`                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-.02em;color:#000000">${escapeHtml(heading)}</h1>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444444">
                  Hey ${escapeHtml(input.name)}, you have been added to this tournament!
                </p>
                <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#444444">
                  ${escapeHtml(lead)}
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 28px">
                  <tr>
                    <td style="padding:12px 0;border-top:1px solid #eaeaea;font-size:13px;color:#8f8f8f">Team</td>
                    <td style="padding:12px 0;border-top:1px solid #eaeaea;font-size:13px;text-align:right;font-weight:500;color:#000000">${escapeHtml(input.teamName)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;border-top:1px solid #eaeaea;font-size:13px;color:#8f8f8f">Tournament</td>
                    <td style="padding:12px 0;border-top:1px solid #eaeaea;font-size:13px;text-align:right;font-weight:500;color:#000000">${escapeHtml(input.tournamentName)}</td>
                  </tr>
                </table>
                <a href="${escapeHtml(input.dashboardUrl)}" style="display:inline-block;background:#000000;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-size:14px;font-weight:500">
                  Open your dashboard
                </a>
                <hr style="border:none;border-top:1px solid #eaeaea;margin:32px 0 20px">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#8f8f8f">
                  Every ball you face from here lands on your Howzat record.
                </p>`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface EmailCopy {
  heading: string;
  lead: string;
  footer: string;
}

function otpEmailHtml(
  code: string,
  copy: EmailCopy = {
    heading: 'Confirm your email',
    lead: `Enter this code to finish creating your account. It expires in ${env.OTP_TTL_MINUTES} minutes.`,
    footer: "If you didn't create a Howzat account, you can safely ignore this email.",
  },
): string {
  return shell(`                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-.02em;color:#000000">${copy.heading}</h1>
                <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#444444">
                  ${copy.lead}
                </p>
                <div style="font-size:30px;font-weight:600;letter-spacing:.22em;text-indent:.22em;text-align:center;padding:20px;background:#fafafa;border:1px solid #eaeaea;border-radius:6px;color:#000000;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">
                  ${code}
                </div>
                <hr style="border:none;border-top:1px solid #eaeaea;margin:32px 0 20px">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#8f8f8f">
                  ${copy.footer}
                </p>`);
}
