// src/lib/email/index.ts
// Transactional email via Resend.
// All emails use HTML templates with Cheetah branding.

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

// ─── BASE TEMPLATE ────────────────────────────────────────────────────────────

function baseTemplate(content: string, preheader: string = ''): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cheetah Receipts</title>
</head>
<body style="margin:0;padding:0;background:#070c16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#070c16;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#09111e;border:1px solid #1e293b;border-radius:16px 16px 0 0;padding:28px 32px;">
          <table width="100%"><tr>
            <td style="font-size:24px;">⚡</td>
            <td style="padding-left:10px;">
              <div style="font-weight:900;font-size:20px;color:#f59e0b;letter-spacing:-0.5px;">Cheetah Receipts</div>
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:2px;">The Receipt Marketplace</div>
            </td>
          </tr></table>
        </td></tr>
        <!-- Content -->
        <tr><td style="background:#0f172a;border:1px solid #1e293b;border-top:none;border-bottom:none;padding:32px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#09111e;border:1px solid #1e293b;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
          <p style="color:#475569;font-size:12px;margin:0 0 8px;">
            © 2026 Cheetah Receipts. All rights reserved.
          </p>
          <p style="margin:0;">
            <a href="${APP_URL}" style="color:#64748b;font-size:12px;text-decoration:none;">Marketplace</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}/help" style="color:#64748b;font-size:12px;text-decoration:none;">Help Center</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}/privacy" style="color:#64748b;font-size:12px;text-decoration:none;">Privacy</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, url: string, color = '#f59e0b'): string {
  return `<a href="${url}" style="display:inline-block;background:${color};color:#000;font-weight:800;font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none;margin:20px 0;">${text}</a>`;
}

function h1(text: string): string {
  return `<h1 style="color:#f1f5f9;font-size:24px;font-weight:800;margin:0 0 8px;">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="color:#94a3b8;font-size:15px;line-height:1.6;margin:0 0 16px;">${text}</p>`;
}

function infoBox(rows: [string, string][]): string {
  const rowsHtml = rows.map(([label, value]) => `
    <tr>
      <td style="color:#64748b;font-size:13px;padding:8px 14px;">${label}</td>
      <td style="color:#f1f5f9;font-size:13px;font-weight:600;padding:8px 14px;text-align:right;">${value}</td>
    </tr>
  `).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border:1px solid #1e293b;border-radius:10px;margin:16px 0;">${rowsHtml}</table>`;
}

// ─── EMAIL FUNCTIONS ──────────────────────────────────────────────────────────

export async function sendPurchaseConfirmationToBuyer(params: {
  to: string;
  buyerName: string;
  orderId: string;
  storeName: string;
  receiptTotal: number;
  listingPrice: number;
  itemCount: number;
  sellerName: string;
}) {
  const content = `
    ${h1('🎉 Purchase Confirmed!')}
    ${p(`Hi ${params.buyerName}, your receipt purchase is complete. You now have full access to this receipt's data.`)}
    ${infoBox([
      ['Order ID', `#${params.orderId.slice(0, 8).toUpperCase()}`],
      ['Store', params.storeName],
      ['Receipt Total', `$${params.receiptTotal.toFixed(2)}`],
      ['Items', `${params.itemCount} items`],
      ['Seller', params.sellerName],
      ['Amount Paid', `$${params.listingPrice.toFixed(2)}`],
    ])}
    ${btn('View Receipt', `${APP_URL}/orders/${params.orderId}`)}
    ${p('Your purchase is protected by Cheetah Buyer Protection. If there are any issues, you can open a dispute within 7 days.')}
  `;
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `✅ Receipt Purchased — ${params.storeName} ($${params.listingPrice.toFixed(2)})`,
    html: baseTemplate(content, `Your ${params.storeName} receipt purchase is confirmed.`),
  });
}

export async function sendSaleNotificationToSeller(params: {
  to: string;
  sellerName: string;
  orderId: string;
  storeName: string;
  listingPrice: number;
  sellerPayout: number;
  buyerName: string;
}) {
  const content = `
    ${h1('💰 You Made a Sale!')}
    ${p(`Great news ${params.sellerName}! Your ${params.storeName} receipt was just purchased.`)}
    ${infoBox([
      ['Order ID', `#${params.orderId.slice(0, 8).toUpperCase()}`],
      ['Receipt', params.storeName],
      ['Sale Price', `$${params.listingPrice.toFixed(2)}`],
      ['Platform Fee (10%)', `-$${(params.listingPrice * 0.10).toFixed(2)}`],
      ['Your Payout', `$${params.sellerPayout.toFixed(2)}`],
    ])}
    ${btn('View Sale', `${APP_URL}/dashboard/sales/${params.orderId}`)}
    ${p('Your payout will be transferred to your connected bank account within 2-3 business days.')}
  `;
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `💸 Sale! ${params.storeName} receipt → $${params.sellerPayout.toFixed(2)} to you`,
    html: baseTemplate(content, `Your ${params.storeName} receipt sold for $${params.listingPrice.toFixed(2)}.`),
  });
}

export async function sendDisputeOpenedEmail(params: {
  to: string;
  name: string;
  role: 'buyer' | 'seller';
  orderId: string;
  disputeId: string;
  storeName: string;
  reason: string;
}) {
  const isSeller = params.role === 'seller';
  const content = `
    ${h1(`⚠️ Dispute ${isSeller ? 'Opened on Your Sale' : 'Opened'}`)}
    ${p(isSeller
      ? `Hi ${params.name}, a buyer has opened a dispute on your ${params.storeName} receipt sale.`
      : `Hi ${params.name}, your dispute has been opened and our team has been notified.`
    )}
    ${infoBox([
      ['Order', `#${params.orderId.slice(0, 8).toUpperCase()}`],
      ['Receipt', params.storeName],
      ['Reason', params.reason],
      ['Status', 'Open — awaiting response'],
    ])}
    ${btn('View Dispute', `${APP_URL}/disputes/${params.disputeId}`, '#ef4444')}
    ${p(isSeller
      ? 'Please respond within 48 hours to avoid automatic resolution in the buyer\'s favor.'
      : 'We will review your dispute and respond within 24-48 hours. You can add more information or evidence at any time.'
    )}
  `;
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `⚠️ Dispute #${params.disputeId.slice(0, 8).toUpperCase()} — ${params.storeName}`,
    html: baseTemplate(content),
  });
}

export async function sendDisputeResolvedEmail(params: {
  to: string;
  name: string;
  orderId: string;
  disputeId: string;
  resolution: string;
  inFavorOf: 'buyer' | 'seller';
  refundAmount?: number;
}) {
  const content = `
    ${h1('⚖️ Dispute Resolved')}
    ${p(`Hi ${params.name}, your dispute has been resolved.`)}
    ${infoBox([
      ['Order', `#${params.orderId.slice(0, 8).toUpperCase()}`],
      ['Resolution', params.resolution],
      ['Decision', `In favor of ${params.inFavorOf}`],
      ...(params.refundAmount ? [['Refund Amount', `$${params.refundAmount.toFixed(2)}`] as [string, string]] : []),
    ])}
    ${btn('View Resolution', `${APP_URL}/disputes/${params.disputeId}`)}
  `;
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `⚖️ Dispute Resolved — ${params.inFavorOf === 'buyer' ? 'Refund Issued' : 'Sale Upheld'}`,
    html: baseTemplate(content),
  });
}

export async function sendListingApprovedEmail(params: {
  to: string;
  sellerName: string;
  receiptId: string;
  storeName: string;
  listingPrice: number;
}) {
  const content = `
    ${h1('✅ Your Listing is Live!')}
    ${p(`Hi ${params.sellerName}, your ${params.storeName} receipt has been approved and is now live on the marketplace.`)}
    ${infoBox([
      ['Store', params.storeName],
      ['Listing Price', `$${params.listingPrice.toFixed(2)}`],
      ['Your Payout (90%)', `$${(params.listingPrice * 0.90).toFixed(2)}`],
      ['Status', 'Active — visible to buyers'],
    ])}
    ${btn('View Your Listing', `${APP_URL}/marketplace/${params.receiptId}`)}
  `;
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `✅ Your ${params.storeName} receipt is live on Cheetah!`,
    html: baseTemplate(content),
  });
}

export async function sendListingFlaggedEmail(params: {
  to: string;
  sellerName: string;
  receiptId: string;
  storeName: string;
  reason: string;
}) {
  const content = `
    ${h1('🚩 Listing Flagged for Review')}
    ${p(`Hi ${params.sellerName}, your ${params.storeName} receipt listing has been flagged for manual review.`)}
    ${infoBox([
      ['Store', params.storeName],
      ['Reason', params.reason],
      ['Status', 'Under Review'],
    ])}
    ${p('Our team will review your listing within 24 hours. If approved, it will go live automatically. If you believe this was flagged in error, please contact support.')}
    ${btn('Contact Support', `${APP_URL}/support`, '#64748b')}
  `;
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `🚩 Your ${params.storeName} listing is under review`,
    html: baseTemplate(content),
  });
}

export async function sendPayoutEmail(params: {
  to: string;
  sellerName: string;
  amount: number;
  orderId: string;
}) {
  const content = `
    ${h1('💸 Payout Sent!')}
    ${p(`Hi ${params.sellerName}, your payout has been sent to your bank account.`)}
    ${infoBox([
      ['Amount', `$${params.amount.toFixed(2)}`],
      ['Order', `#${params.orderId.slice(0, 8).toUpperCase()}`],
      ['Expected Arrival', '2-3 business days'],
    ])}
    ${btn('View Earnings', `${APP_URL}/dashboard/payouts`)}
  `;
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `💸 $${params.amount.toFixed(2)} payout sent to your bank`,
    html: baseTemplate(content),
  });
}

export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
}) {
  const content = `
    ${h1('⚡ Welcome to Cheetah Receipts!')}
    ${p(`Hi ${params.name}! You're now part of the first marketplace for buying and selling cash receipts.`)}
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
      ${[
        ['🛒', 'Buy Receipts', 'Find receipts for returns, warranty claims, or reimbursements.'],
        ['💰', 'Sell Receipts', 'Turn receipts you don\'t need into cash — list in under 2 minutes.'],
        ['🛡️', 'Protected', 'Every transaction is covered by Cheetah Buyer Protection.'],
      ].map(([icon, title, desc]) => `
        <tr><td style="padding:10px 0;">
          <table><tr>
            <td style="font-size:24px;padding-right:14px;vertical-align:top;">${icon}</td>
            <td>
              <div style="color:#f1f5f9;font-weight:700;font-size:15px;">${title}</div>
              <div style="color:#64748b;font-size:13px;margin-top:3px;">${desc}</div>
            </td>
          </tr></table>
        </td></tr>
      `).join('')}
    </table>
    ${btn('Browse Marketplace', `${APP_URL}/marketplace`)}
  `;
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: '⚡ Welcome to Cheetah Receipts!',
    html: baseTemplate(content, 'The receipt marketplace is ready for you.'),
  });
}
