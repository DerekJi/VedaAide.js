// ─────────────────────────────────────────────────────────────────────────────
// Managed Identity token helper
// Supports both Azure Container Apps (IDENTITY_ENDPOINT/IDENTITY_HEADER)
// and IMDS endpoint (169.254.169.254) for VMs/App Service.
// Tokens are cached until 5 minutes before expiry to avoid redundant requests.
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "@/lib/logger";

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
    logger.debug({ resource, cacheKey }, "MSI token from cache");
    return cached.token;
  }

  // Azure Container Apps uses IDENTITY_ENDPOINT + IDENTITY_HEADER (not IMDS 169.254.169.254)
  const identityEndpoint = process.env.IDENTITY_ENDPOINT;
  const identityHeader = process.env.IDENTITY_HEADER;

  let url: string;
  let headers: Record<string, string>;

  if (identityEndpoint && identityHeader) {
    // Azure Container Apps / App Service managed identity
    const params = new URLSearchParams({
      "api-version": "2019-08-01",
      resource,
      ...(clientId ? { client_id: clientId } : {}),
    });
    url = `${identityEndpoint}?${params}`;
    headers = { "X-IDENTITY-HEADER": identityHeader };
    logger.debug({ url, clientId }, "Using Container Apps MSI endpoint");
  } else {
    // IMDS fallback (VMs, local emulation)
    const params = new URLSearchParams({
      "api-version": "2018-02-01",
      resource,
      ...(clientId ? { client_id: clientId } : {}),
    });
    url = `http://169.254.169.254/metadata/identity/oauth2/token?${params}`;
    headers = { Metadata: "true" };
    logger.debug({ url, clientId }, "Using IMDS MSI endpoint");
  }

  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug({ url, clientId, attempt, maxRetries }, "Fetching MSI token");

      // Use AbortController for timeout (increased to 15s for slow IMDS)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        const err = `MSI token request failed (${response.status}): ${text}`;
        logger.error({ status: response.status, text, attempt }, err);
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff: 500ms, 1s, 2s)
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        throw new Error(err);
      }

      const data = (await response.json()) as {
        access_token: string;
        expires_in: string;
      };

      // Cache with 5-minute buffer before actual expiry
      const expiresAt = Date.now() + (parseInt(data.expires_in, 10) - 300) * 1000;
      cache.set(cacheKey, { token: data.access_token, expiresAt });
      logger.debug({ resource, expiresIn: data.expires_in, attempt }, "MSI token acquired");

      return data.access_token;
    } catch (cause) {
      const causeStr = cause instanceof Error ? cause.message : String(cause);
      logger.warn(
        {
          resource,
          url,
          clientId,
          attempt,
          maxRetries,
          cause: causeStr,
        },
        "MSI token fetch attempt failed",
      );

      if (attempt === maxRetries) {
        logger.error(
          {
            resource,
            url,
            clientId,
            cause: causeStr,
          },
          "MSI token fetch failed after all retries",
        );
        throw cause;
      }

      // Wait before retry (exponential backoff)
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }

  // Should never reach here
  throw new Error(`MSI token retrieval failed after ${maxRetries} attempts`);
}
