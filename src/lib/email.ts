import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function sendOrgInvitationEmail(
  email: string,
  orgName: string,
  inviteLink: string,
  orgPlan: string | undefined = "free",
  orgLogo?: string | null
) {
  try {
    const safeOrgName = escapeHtml(orgName);
    const safeInviteLink = escapeHtml(inviteLink);
    const safeLogoUrl = safeImageUrl(orgLogo);
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Scrunity <noreply@scrunity.com>",
      replyTo: "support@scrunity.com",
      to: email,
      subject: `You have been invited to join ${orgName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${orgPlan !== "free" && safeLogoUrl ? `<img src="${escapeHtml(safeLogoUrl)}" alt="Logo" style="max-height: 40px; margin-bottom: 20px;" />` : ''}
          <h2 style="margin-top: 0;">Workspace Invitation</h2>
          <p>You have been invited to join <strong>${safeOrgName}</strong>.</p>
          <p>Click the link below to accept the invitation and access the workspace:</p>
          <a href="${safeInviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #111111; color: #fff; text-decoration: none; border-radius: 6px; margin-top: 20px; font-weight: bold;">
            Accept Invitation
          </a>
          <p style="margin-top: 30px; font-size: 12px; color: #666;">
            If you did not expect this invitation, you can safely ignore this email.
          </p>
          ${orgPlan === "free" ? `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaeaea; text-align: center; font-size: 12px; color: #888;">
              Powered by <span style="font-weight: bold; color: #333;">Scrunity</span>
            </div>
          ` : ''}
        </div>
      `,
    });

    if (error) {
      console.error("Resend API Error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Email sending error:", error);
    return { success: false, error };
  }
}

// Alias for backwards compatibility
export const sendProjectInvitationEmail = sendOrgInvitationEmail;
