/**
 * Email service using Resend.
 *
 * All functions are no-ops when RESEND_API_KEY is not set, so the rest of
 * the app works fine even before email is configured.
 *
 * Install: npm install resend
 */

const FROM = process.env.RESEND_FROM_EMAIL || 'Day Dream Dictionary <onboarding@resend.dev>';

let resend = null;

async function getResend() {
  if (resend) return resend;
  if (!process.env.RESEND_API_KEY) return null;

  try {
    const { Resend } = await import('resend');
    resend = new Resend(process.env.RESEND_API_KEY);
  } catch {
    console.warn('[email] resend package not installed — email disabled');
    return null;
  }
  return resend;
}

async function send({ to, subject, html }) {
  const client = await getResend();
  if (!client) return; // silently skip when not configured

  try {
    const result = await client.emails.send({ from: FROM, to, subject, html });
    console.log('[email] sent ok, id:', result?.data?.id ?? result?.id ?? JSON.stringify(result));
  } catch (err) {
    console.error('[email] send error:', err.message, err.statusCode ?? '');
    // Do not throw — email failure should never block the main flow
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

const brandHeader = `
  <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:24px;text-align:center;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-family:Georgia,serif;font-size:22px;">&#128164; Day Dream Dictionary</h1>
  </div>`;

const brandFooter = `
  <div style="background:#f8f8f8;padding:16px;text-align:center;border-radius:0 0 12px 12px;font-size:12px;color:#aaa;">
    <p style="margin:0;">Day Dream Dictionary &middot; <a href="https://daydreamdictionary.com" style="color:#667eea;">daydreamdictionary.com</a></p>
    <p style="margin:4px 0 0;">This is a transactional email. To manage preferences, visit your <a href="https://daydreamdictionary.com/account-settings.html" style="color:#667eea;">account settings</a>.</p>
  </div>`;

function wrap(body) {
  return `<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;background:white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.08);">
    ${brandHeader}
    <div style="padding:28px 32px;">${body}</div>
    ${brandFooter}
  </div>`;
}

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Send a subscription purchase confirmation.
 */
export async function sendPurchaseReceipt({ to, planName, amount, nextBillingDate }) {
  await send({
    to,
    subject: `Your ${planName} subscription is active — Day Dream Dictionary`,
    html: wrap(`
      <h2 style="color:#333;margin-top:0;">Thank you for subscribing!</h2>
      <p style="color:#555;">Your <strong style="color:#667eea;">${planName}</strong> plan is now active.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#888;border-bottom:1px solid #eee;">Amount charged</td>
            <td style="padding:8px 0;font-weight:600;text-align:right;border-bottom:1px solid #eee;">$${amount}</td></tr>
        <tr><td style="padding:8px 0;color:#888;">Next billing date</td>
            <td style="padding:8px 0;font-weight:600;text-align:right;">${nextBillingDate}</td></tr>
      </table>
      <a href="https://daydreamdictionary.com/profile-dashboard.html"
         style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
        Go to Dashboard
      </a>`),
  });
}

/**
 * Send a credit pack purchase confirmation.
 */
export async function sendCreditReceipt({ to, credits, amount, newBalance }) {
  await send({
    to,
    subject: `${credits} credits added — Day Dream Dictionary`,
    html: wrap(`
      <h2 style="color:#333;margin-top:0;">Credits Added!</h2>
      <p style="color:#555;">Your account has been topped up with <strong style="color:#667eea;">${credits} credits</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px 0;color:#888;border-bottom:1px solid #eee;">Credits purchased</td>
            <td style="padding:8px 0;font-weight:600;text-align:right;border-bottom:1px solid #eee;">${credits}</td></tr>
        <tr><td style="padding:8px 0;color:#888;border-bottom:1px solid #eee;">Amount charged</td>
            <td style="padding:8px 0;font-weight:600;text-align:right;border-bottom:1px solid #eee;">$${amount}</td></tr>
        <tr><td style="padding:8px 0;color:#888;">New balance</td>
            <td style="padding:8px 0;font-weight:600;text-align:right;">${newBalance} credits</td></tr>
      </table>
      <a href="https://daydreamdictionary.com/dream-interpretation.html"
         style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
        Interpret a Dream
      </a>`),
  });
}

/**
 * Send a dream interpretation result (opt-in only).
 */
export async function sendDreamResult({ to, dreamText, interpretation }) {
  const themes = (interpretation.mainThemes || []).join(', ');
  await send({
    to,
    subject: `Your dream interpretation — Day Dream Dictionary`,
    html: wrap(`
      <h2 style="color:#333;margin-top:0;">Your Dream Interpretation</h2>
      <blockquote style="border-left:3px solid #667eea;padding:8px 16px;color:#666;font-style:italic;margin:0 0 16px;">
        "${dreamText.length > 200 ? dreamText.slice(0, 200) + '...' : dreamText}"
      </blockquote>
      <p><strong style="color:#764ba2;">Main Themes:</strong> ${themes}</p>
      <p><strong style="color:#764ba2;">Emotional Tone:</strong> ${interpretation.emotionalTone}</p>
      <p><strong style="color:#764ba2;">Guidance:</strong> ${interpretation.guidance}</p>
      <a href="https://daydreamdictionary.com/dream-history.html"
         style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">
        View Full Interpretation
      </a>`),
  });
}

/**
 * Send a subscription cancellation confirmation.
 */
export async function sendCancellationConfirmation({ to, accessUntil }) {
  await send({
    to,
    subject: `Subscription canceled — Day Dream Dictionary`,
    html: wrap(`
      <h2 style="color:#333;margin-top:0;">Subscription Canceled</h2>
      <p style="color:#555;">Your subscription has been canceled. You will keep full access until <strong>${accessUntil}</strong>.</p>
      <p style="color:#555;">We hope to see you again. If you change your mind, you can resubscribe anytime.</p>
      <a href="https://daydreamdictionary.com/payment.html"
         style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
        Resubscribe
      </a>`),
  });
}

/**
 * Send a welcome email after signup.
 */
export async function sendWelcome({ to, displayName }) {
  await send({
    to,
    subject: `Welcome to Day Dream Dictionary!`,
    html: wrap(`
      <h2 style="color:#333;margin-top:0;">Welcome, ${displayName}!</h2>
      <p style="color:#555;">You now have <strong>3 free deep interpretations</strong> every month to explore the meaning of your dreams.</p>
      <p style="color:#555;">Whenever you're ready, simply describe a dream and let our AI guide you through its symbols, themes, and deeper meaning.</p>
      <a href="https://daydreamdictionary.com/dream-interpretation.html"
         style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">
        Interpret Your First Dream
      </a>`),
  });
}
