import { Resend } from 'resend';
import { emailEnabled, env } from '../../config/env';
import { logger } from '../../lib/logger';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/**
 * Sent once, at signup, to prove the address belongs to whoever typed it.
 * Everyday sign-in is username and password and never touches this.
 *
 * With no RESEND_API_KEY the code is logged instead of sent. That is the
 * intended development path, not a degraded one — it keeps signup working
 * offline and on a machine with no verified sending domain.
 */
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
    // Surfacing the provider error to the caller would leak infrastructure
    // detail; the log has it, the user gets a generic failure.
    logger.error({ err: error, email }, 'Resend failed to send the verification code');
    throw new Error('Could not send the verification code');
  }
}

/**
 * The way back in when the password is gone. Worded to be unambiguous about
 * what it does, because this is the one email an attacker would love a target
 * to skim past — "someone asked to reset your password" has to be the thing
 * you read even if you read nothing else.
 */
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
  /** The recipient's own name — the greeting, not the organizer's. */
  name: string;
  teamName: string;
  tournamentName: string;
  organizerName: string;
  /** Absolute link into the web app; where the squad now shows up. */
  dashboardUrl: string;
}

/**
 * Sent when an organizer adds a registered handle to a squad.
 *
 * Best-effort by construction: the caller never awaits this in a way that can
 * fail the write. Being in a squad is a fact in the database and the in-app
 * notice is already there — a bounced email must not undo either, and must
 * certainly not fail the organizer's paste of eleven names.
 */
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

function squadAdditionHtml(input: SquadAdditionEmail, heading: string, lead: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px;background:#f5f6f8;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f1729">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb">
      <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Howzat</p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#374151">
        Hey ${escapeHtml(input.name)}, you have been added to this tournament!
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#374151">
        ${escapeHtml(lead)}
      </p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px">
        <tr>
          <td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">Team</td>
          <td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:14px;text-align:right;font-weight:600">${escapeHtml(input.teamName)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">Tournament</td>
          <td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:14px;text-align:right;font-weight:600">${escapeHtml(input.tournamentName)}</td>
        </tr>
      </table>
      <a href="${escapeHtml(input.dashboardUrl)}" style="display:inline-block;background:#14120f;color:#f4efe6;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600">
        Open your dashboard
      </a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b7280">
        Every ball you face from here lands on your Howzat record.
      </p>
    </div>
  </body>
</html>`;
}

/** Names and team names are user input and go into an HTML document. */
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
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px;background:#f5f6f8;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f1729">
    <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e5e7eb">
      <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Howzat</p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">${copy.heading}</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#374151">
        ${copy.lead}
      </p>
      <div style="font-size:34px;font-weight:700;letter-spacing:.28em;text-align:center;padding:18px;background:#f3f4f6;border-radius:12px;font-variant-numeric:tabular-nums">
        ${code}
      </div>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#6b7280">
        ${copy.footer}
      </p>
    </div>
  </body>
</html>`;
}
