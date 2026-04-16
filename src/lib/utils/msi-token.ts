// ─────────────────────────────────────────────────────────────────────────────
// Managed Identity token helper for Azure Container Apps
// Fetches an access token from the IMDS endpoint using a User-Assigned MSI.
// Tokens are cached until 5 minutes before expiry to avoid redundant requests.
// ─────────────────────────────────────────────────────────────────────────────

interface TokenCache {
  token: string;
  expiresAt: number; // ms since epoch
}

const cache = new Map<string, TokenCache>();

/**
 * Get an access token for the given Azure resource using Managed Identity.
 * @param resource - e.g. "https://cognitiveservices.azure.com/"
 */
export async function getMsiToken(resource: string): Promise<string> {
  const clientId = process.env.AZURE_CLIENT_ID;
  const cacheKey = `${resource}::${clientId ?? "system"}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const params = new URLSearchParams({
    "api-version": "2018-02-01",
    resource,
    ...(clientId ? { client_id: clientId } : {}),
  });

  const url = `http://169.254.169.254/metadata/identity/oauth2/token?${params}`;

  const response = await fetch(url, {
    headers: { Metadata: "true" },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MSI token request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: string };

  // Cache with 5-minute buffer before actual expiry
  const expiresAt = Date.now() + (parseInt(data.expires_in, 10) - 300) * 1000;
  cache.set(cacheKey, { token: data.access_token, expiresAt });

  return data.access_token;
}
