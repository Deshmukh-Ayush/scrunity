import { db } from "@/utils/db";
import { gtmConnectedMailbox } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encryptToken, decryptToken } from "./encryption";
import type { NormalizedMailMessage, SendMailboxResult } from "./mailbox-types";

export interface MicrosoftTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  email: string;
  displayName?: string;
  tenantId?: string;
}

export interface SendMicrosoftEmailParams {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  fromEmail?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

const MICROSOFT_GRAPH_ENDPOINT = "https://graph.microsoft.com/v1.0";

export const MICROSOFT_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "Mail.Read",
  "Mail.ReadWrite",
  "Mail.Send",
  "User.Read",
];

function getTenantEndpoint(tenantId = "common"): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0`;
}

/**
 * Builds the Microsoft OAuth 2.0 authorization URL for connecting a Microsoft 365 or Outlook mailbox.
 */
export function getMicrosoftOAuthUrl({
  state,
  redirectUri,
  tenantId = "common",
}: {
  state: string;
  redirectUri: string;
  tenantId?: string;
}): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.AZURE_CLIENT_ID;

  if (!clientId) {
    throw new Error(
      "MICROSOFT_CLIENT_ID is not configured. Please set MICROSOFT_CLIENT_ID in your environment."
    );
  }

  const endpoint = `${getTenantEndpoint(tenantId)}/authorize`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: MICROSOFT_SCOPES.join(" "),
    state,
    prompt: "select_account",
  });

  return `${endpoint}?${params.toString()}`;
}

/**
 * Exchanges authorization code for Microsoft access and refresh tokens.
 */
export async function exchangeMicrosoftCodeForTokens({
  code,
  redirectUri,
  tenantId = "common",
}: {
  code: string;
  redirectUri: string;
  tenantId?: string;
}): Promise<MicrosoftTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.AZURE_CLIENT_ID;
  const clientSecret =
    process.env.MICROSOFT_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be configured"
    );
  }

  const tokenEndpoint = `${getTenantEndpoint(tenantId)}/token`;
  const tokenResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      scope: MICROSOFT_SCOPES.join(" "),
    }),
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    throw new Error(
      `Microsoft token exchange failed (${tokenResponse.status}): ${errorBody}`
    );
  }

  interface MicrosoftTokenPayload {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }

  const tokenData = (await tokenResponse.json()) as MicrosoftTokenPayload;

  if (!tokenData.refresh_token) {
    throw new Error(
      "No refresh token returned by Microsoft. Ensure offline_access scope was requested."
    );
  }

  // Retrieve user identity via Microsoft Graph /me
  const userRes = await fetch(`${MICROSOFT_GRAPH_ENDPOINT}/me`, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
    },
  });

  if (!userRes.ok) {
    const errText = await userRes.text();
    throw new Error(
      `Failed to retrieve Microsoft user profile (${userRes.status}): ${errText}`
    );
  }

  interface MicrosoftUser {
    mail?: string | null;
    userPrincipalName?: string | null;
    displayName?: string | null;
    id: string;
  }

  const userData = (await userRes.json()) as MicrosoftUser;
  const email = (userData.mail || userData.userPrincipalName || "").toLowerCase().trim();

  if (!email) {
    throw new Error("Unable to resolve email address from Microsoft user profile");
  }

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in,
    email,
    displayName: userData.displayName || undefined,
    tenantId,
  };
}

/**
 * Resolves a valid access token for the given connected Microsoft mailbox.
 * Automatically refreshes short-lived tokens and handles Microsoft refresh-token rotation.
 */
export async function getValidMicrosoftAccessToken(mailboxId: string): Promise<string> {
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

  if (!mailbox.encryptedRefreshToken) {
    throw new Error(`Mailbox ${mailbox.email} has no refresh token`);
  }

  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 min safety buffer

  if (
    mailbox.encryptedAccessToken &&
    mailbox.accessTokenExpiresAt &&
    mailbox.accessTokenExpiresAt.getTime() > now.getTime() + bufferMs
  ) {
    return decryptToken(mailbox.encryptedAccessToken);
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID || process.env.AZURE_CLIENT_ID;
  const clientSecret =
    process.env.MICROSOFT_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be configured"
    );
  }

  const plainRefreshToken = decryptToken(mailbox.encryptedRefreshToken);
  const tenantId = mailbox.metadata?.microsoftTenantId || "common";
  const tokenEndpoint = `${getTenantEndpoint(tenantId)}/token`;

  const refreshResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: plainRefreshToken,
      grant_type: "refresh_token",
      scope: MICROSOFT_SCOPES.join(" "),
    }),
  });

  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text();
    if (
      refreshResponse.status === 400 &&
      (errorText.includes("invalid_grant") ||
        errorText.includes("revoked") ||
        errorText.includes("expired") ||
        errorText.includes("interaction_required"))
    ) {
      await db
        .update(gtmConnectedMailbox)
        .set({
          status: "revoked",
          encryptedAccessToken: null,
          updatedAt: new Date(),
        })
        .where(eq(gtmConnectedMailbox.id, mailboxId));

      throw new Error(
        `Microsoft authorization revoked or expired for ${mailbox.email}. Please reconnect.`
      );
    }

    throw new Error(
      `Failed to refresh Microsoft access token (${refreshResponse.status}): ${errorText}`
    );
  }

  interface MicrosoftRefreshResponse {
    access_token: string;
    refresh_token?: string; // Microsoft returns a new refresh token on rotation
    expires_in: number;
  }

  const refreshData = (await refreshResponse.json()) as MicrosoftRefreshResponse;
  const newAccessToken = refreshData.access_token;
  const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);
  const encryptedNewAccessToken = encryptToken(newAccessToken);

  // Microsoft Refresh Token Rotation: always update refresh token if a new one is provided
  const updatePayload: Record<string, any> = {
    encryptedAccessToken: encryptedNewAccessToken,
    accessTokenExpiresAt: newExpiresAt,
    updatedAt: new Date(),
  };

  if (refreshData.refresh_token) {
    updatePayload.encryptedRefreshToken = encryptToken(refreshData.refresh_token);
  }

  await db
    .update(gtmConnectedMailbox)
    .set(updatePayload)
    .where(eq(gtmConnectedMailbox.id, mailboxId));

  return newAccessToken;
}

/**
 * Sends an email via Microsoft Graph API.
 * Uses draft creation + /send to reliably capture messageId and conversationId.
 */
export async function sendMicrosoftMessage({
  accessToken,
  to,
  subject,
  body,
  fromEmail,
  threadId,
  inReplyTo,
  references,
}: SendMicrosoftEmailParams): Promise<SendMailboxResult> {
  const cleanSubject = subject.replace(/[\r\n]+/g, " ");

  const headers: Array<{ name: string; value: string }> = [];
  if (inReplyTo) {
    headers.push({ name: "In-Reply-To", value: inReplyTo });
  }
  if (references || inReplyTo) {
    headers.push({ name: "References", value: references || inReplyTo! });
  }

  const draftPayload: Record<string, any> = {
    subject: cleanSubject,
    body: {
      contentType: "Text",
      content: body,
    },
    toRecipients: [
      {
        emailAddress: {
          address: to,
        },
      },
    ],
  };

  if (headers.length > 0) {
    draftPayload.internetMessageHeaders = headers;
  }

  // 1. Create message in drafts to obtain Graph id & conversationId
  const createRes = await fetch(`${MICROSOFT_GRAPH_ENDPOINT}/me/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(draftPayload),
  });

  if (!createRes.ok) {
    const errorBody = await createRes.text();
    throw new Error(`Microsoft Graph create draft failed (${createRes.status}): ${errorBody}`);
  }

  interface GraphDraftResponse {
    id: string;
    conversationId: string;
    internetMessageId?: string;
  }

  const createdMessage = (await createRes.json()) as GraphDraftResponse;
  const messageId = createdMessage.id;
  const conversationId = createdMessage.conversationId || threadId;

  // 2. Send the message
  const sendRes = await fetch(
    `${MICROSOFT_GRAPH_ENDPOINT}/me/messages/${messageId}/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!sendRes.ok) {
    const errorBody = await sendRes.text();
    throw new Error(`Microsoft Graph send failed (${sendRes.status}): ${errorBody}`);
  }

  return {
    messageId,
    threadId: conversationId,
  };
}

export interface MicrosoftGraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview?: string;
  body?: {
    contentType: string;
    content: string;
  };
  from?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  toRecipients?: Array<{
    emailAddress?: {
      name?: string;
      address?: string;
    };
  }>;
  receivedDateTime?: string;
  createdDateTime?: string;
  internetMessageHeaders?: Array<{
    name: string;
    value: string;
  }>;
  isDraft?: boolean;
}

/**
 * Fetches messages belonging to a conversation from Microsoft Graph.
 */
export async function getMicrosoftConversationMessages({
  accessToken,
  conversationId,
}: {
  accessToken: string;
  conversationId: string;
}): Promise<MicrosoftGraphMessage[]> {
  const url = `${MICROSOFT_GRAPH_ENDPOINT}/me/messages?$filter=conversationId eq '${encodeURIComponent(
    conversationId
  )}'&$orderby=receivedDateTime asc&$top=50&$select=id,conversationId,subject,bodyPreview,body,from,toRecipients,receivedDateTime,createdDateTime,internetMessageHeaders,isDraft`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Microsoft Graph messages query failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  return (data.value || []) as MicrosoftGraphMessage[];
}

/**
 * Normalizes a Microsoft Graph message into the standard internal representation.
 */
export function normalizeMicrosoftMessage(
  msg: MicrosoftGraphMessage,
  mailboxEmail: string
): NormalizedMailMessage {
  const fromAddress = msg.from?.emailAddress?.address?.trim().toLowerCase() || "";
  const fromName = msg.from?.emailAddress?.name || fromAddress;
  const toAddress =
    msg.toRecipients?.[0]?.emailAddress?.address?.trim().toLowerCase() || "";
  const isOutbound =
    fromAddress === mailboxEmail.trim().toLowerCase() || !!msg.isDraft;

  // Clean body text
  let bodyText = msg.body?.content || "";
  if (msg.body?.contentType?.toLowerCase() === "html") {
    bodyText = bodyText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const headers: Record<string, string> = {};
  if (Array.isArray(msg.internetMessageHeaders)) {
    for (const h of msg.internetMessageHeaders) {
      if (h?.name && h?.value) {
        headers[h.name.toLowerCase()] = h.value;
      }
    }
  }

  const timestamp = msg.receivedDateTime
    ? new Date(msg.receivedDateTime)
    : msg.createdDateTime
      ? new Date(msg.createdDateTime)
      : new Date();

  return {
    id: msg.id,
    threadId: msg.conversationId,
    from: fromAddress,
    fromName,
    to: toAddress,
    subject: msg.subject || "",
    body: bodyText,
    snippet: msg.bodyPreview || bodyText.slice(0, 200),
    timestamp,
    headers,
    isOutbound,
  };
}
