import { db } from "@/utils/db";
import { gtmConnectedMailbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptToken, decryptToken } from "./encryption";

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
}

export interface SendEmailParams {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  fromEmail?: string;
}

export interface SendEmailResult {
  messageId: string;
  threadId?: string;
}

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
const GMAIL_SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const USERINFO_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

/**
 * Builds the Google OAuth consent screen URL requesting least-privilege gmail.send and user email scopes.
 */
export function getGoogleOAuthUrl({
  state,
  redirectUri,
}: {
  state: string;
  redirectUri: string;
}): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not set in environment");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `${GMAIL_SEND_SCOPE} ${USERINFO_EMAIL_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Exchanges authorization code for Google access and refresh tokens.
 */
export async function exchangeCodeForTokens({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured in environment"
    );
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(`Google token exchange failed (${tokenResponse.status}): ${errorBody}`);
  }

  interface GoogleTokenSuccessPayload {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }

  const tokenData = (await tokenResponse.json()) as GoogleTokenSuccessPayload;

  if (!tokenData.refresh_token) {
    throw new Error(
      "No refresh token returned by Google. Ensure access_type=offline and prompt=consent were requested."
    );
  }

  // Fetch the mailbox email identity using the obtained access token
  const userInfoRes = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userInfoRes.ok) {
    const errText = await userInfoRes.text();
    throw new Error(`Failed to retrieve Google userinfo (${userInfoRes.status}): ${errText}`);
  }

  interface UserInfoPayload {
    email: string;
    id: string;
    verified_email?: boolean;
  }

  const userInfo = (await userInfoRes.json()) as UserInfoPayload;

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in,
    email: userInfo.email,
  };
}

/**
 * Resolves a valid access token for the given connected mailbox.
 * Automatically refreshes short-lived access tokens using the encrypted refresh token.
 */
export async function getValidAccessToken(mailboxId: string): Promise<string> {
  const [mailbox] = await db
    .select()
    .from(gtmConnectedMailbox)
    .where(eq(gtmConnectedMailbox.id, mailboxId));

  if (!mailbox) {
    throw new Error(`Connected mailbox ${mailboxId} not found`);
  }

  if (mailbox.status === "revoked") {
    throw new Error(`Connected mailbox (${mailbox.email}) has been revoked`);
  }

  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 minute safety buffer before expiry

  if (
    mailbox.encryptedAccessToken &&
    mailbox.accessTokenExpiresAt &&
    mailbox.accessTokenExpiresAt.getTime() > now.getTime() + bufferMs
  ) {
    return decryptToken(mailbox.encryptedAccessToken);
  }

  // Refresh token using Google OAuth token endpoint
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured");
  }

  const plainRefreshToken = decryptToken(mailbox.encryptedRefreshToken);

  const refreshResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: plainRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text();
    // If token was revoked by user in Google account settings, mark mailbox revoked
    if (
      refreshResponse.status === 400 &&
      (errorText.includes("invalid_grant") || errorText.includes("revoked"))
    ) {
      await db
        .update(gtmConnectedMailbox)
        .set({ status: "revoked", encryptedAccessToken: null, updatedAt: new Date() })
        .where(eq(gtmConnectedMailbox.id, mailboxId));
      throw new Error(`Google authorization revoked for ${mailbox.email}. Please reconnect.`);
    }

    throw new Error(`Failed to refresh Google access token (${refreshResponse.status}): ${errorText}`);
  }

  interface RefreshSuccessPayload {
    access_token: string;
    expires_in: number;
    token_type: string;
  }

  const refreshData = (await refreshResponse.json()) as RefreshSuccessPayload;
  const newAccessToken = refreshData.access_token;
  const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);
  const encryptedNewAccessToken = encryptToken(newAccessToken);

  await db
    .update(gtmConnectedMailbox)
    .set({
      encryptedAccessToken: encryptedNewAccessToken,
      accessTokenExpiresAt: newExpiresAt,
      updatedAt: new Date(),
    })
    .where(eq(gtmConnectedMailbox.id, mailboxId));

  return newAccessToken;
}

/**
 * Builds RFC 2822 / MIME email string and sends it via Gmail users.messages.send API.
 */
export async function sendGmailMessage({
  accessToken,
  to,
  subject,
  body,
  fromEmail,
}: SendEmailParams): Promise<SendEmailResult> {
  const cleanSubject = subject.replace(/[\r\n]+/g, " ");

  const headers = [
    `To: ${to}`,
    fromEmail ? `From: ${fromEmail}` : null,
    `Subject: =?UTF-8?B?${Buffer.from(cleanSubject, "utf-8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
  ]
    .filter(Boolean)
    .join("\r\n");

  const rawMessage = `${headers}\r\n\r\n${body}`;
  const base64UrlMessage = Buffer.from(rawMessage, "utf-8").toString("base64url");

  const response = await fetch(GMAIL_SEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: base64UrlMessage,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gmail API send failed (${response.status}): ${errorBody}`);
  }

  interface GmailSendResponse {
    id: string;
    threadId: string;
    labelIds?: string[];
  }

  const result = (await response.json()) as GmailSendResponse;

  return {
    messageId: result.id,
    threadId: result.threadId,
  };
}
