// @ts-nocheck
import { v } from "convex/values";
import { internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Generates the reminder email HTML
function buildEmailHtml(invoice: any, reminderType: string): { subject: string; html: string } {
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(invoice.amount / 100);

  const dueDate = new Date(invoice.dueDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let subject = "";
  let headline = "";
  let body = "";
  let accentColor = "#2563eb";

  if (reminderType.includes("_days_before")) {
    const days = reminderType.replace("_days_before", "");
    subject = `Payment reminder: Invoice #${invoice.invoiceNumber} due in ${days} day(s)`;
    headline = `Your invoice is due in ${days} day(s)`;
    body = `This is a friendly reminder that invoice <strong>#${invoice.invoiceNumber}</strong> for <strong>${amount}</strong> is due on <strong>${dueDate}</strong>.`;
    accentColor = "#2563eb";
  } else if (reminderType === "on_due_date") {
    subject = `Invoice #${invoice.invoiceNumber} is due today`;
    headline = "Your invoice is due today";
    body = `Invoice <strong>#${invoice.invoiceNumber}</strong> for <strong>${amount}</strong> is due <strong>today</strong>. Please arrange payment to avoid a late notice.`;
    accentColor = "#d97706";
  } else {
    const days = reminderType.replace("_days_after", "");
    subject = `Overdue notice: Invoice #${invoice.invoiceNumber} — ${days} day(s) past due`;
    headline = `Invoice ${days} day(s) overdue`;
    body = `Invoice <strong>#${invoice.invoiceNumber}</strong> for <strong>${amount}</strong> was due on <strong>${dueDate}</strong> and remains unpaid. Please arrange payment at your earliest convenience.`;
    accentColor = "#dc2626";
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <!-- Header -->
        <tr><td style="background:${accentColor};padding:24px 32px">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700">InvoiceTracker</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">${headline}</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6">${body}</p>
          <!-- Invoice box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px">
            <tr><td style="padding:20px">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#6b7280">Invoice #</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#111827">#${invoice.invoiceNumber}</td>
                </tr>
                <tr><td colspan="2" style="padding:6px 0"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0"></td></tr>
                <tr>
                  <td style="font-size:13px;color:#6b7280">Client</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#111827">${invoice.clientName}</td>
                </tr>
                <tr><td colspan="2" style="padding:6px 0"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0"></td></tr>
                <tr>
                  <td style="font-size:13px;color:#6b7280">Amount Due</td>
                  <td align="right" style="font-size:16px;font-weight:700;color:${accentColor}">${amount}</td>
                </tr>
                <tr><td colspan="2" style="padding:6px 0"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0"></td></tr>
                <tr>
                  <td style="font-size:13px;color:#6b7280">Due Date</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#111827">${dueDate}</td>
                </tr>
              </table>
            </td></tr>
          </table>
          ${invoice.description ? `<p style="margin:0 0 24px;font-size:14px;color:#6b7280"><em>${invoice.description}</em></p>` : ""}
          <p style="margin:0;font-size:13px;color:#9ca3af">If you have already arranged payment, please disregard this notice. Questions? Reply to this email.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
          <p style="margin:0;font-size:12px;color:#9ca3af">Sent via InvoiceTracker · Automated payment reminder</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

// Internal action: send a reminder email for one invoice
export const sendReminder = internalAction({
  args: {
    invoiceId: v.id("invoices"),
    reminderType: v.string(),
  },
  handler: async (ctx, { invoiceId, reminderType }) => {
    // Fetch invoice
    const invoice = await ctx.runQuery(internal.invoices.getById, { id: invoiceId });
    if (!invoice) return; // deleted
    if (invoice.status === "paid") return; // already paid — skip

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

    if (!apiKey) {
      console.error("RESEND_API_KEY not set — skipping reminder send");
      await ctx.runMutation(internal.reminders.logReminder, {
        invoiceId,
        ownerId: invoice.ownerId,
        reminderType,
        status: "failed",
        errorMessage: "RESEND_API_KEY not configured",
      });
      return;
    }

    const { subject, html } = buildEmailHtml(invoice, reminderType);

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: invoice.clientEmail,
          subject,
          html,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? `Resend error ${response.status}`);
      }

      await ctx.runMutation(internal.reminders.logReminder, {
        invoiceId,
        ownerId: invoice.ownerId,
        reminderType,
        status: "sent",
        resendMessageId: data.id,
      });
    } catch (err: any) {
      await ctx.runMutation(internal.reminders.logReminder, {
        invoiceId,
        ownerId: invoice.ownerId,
        reminderType,
        status: "failed",
        errorMessage: String(err?.message ?? err),
      });
    }
  },
});

// Internal mutation: write to reminderLog table
export const logReminder = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    ownerId: v.string(),
    reminderType: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    resendMessageId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("reminderLog", {
      ...args,
      sentAt: Date.now(),
    });
  },
});
