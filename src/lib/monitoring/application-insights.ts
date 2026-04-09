// ─────────────────────────────────────────────────────────────────────────────
// T15: Application Insights integration
// SRP: This module is solely responsible for telemetry/observability.
//
// Usage (server-side only — call once at app startup):
//   import { initApplicationInsights, trackEvent, trackDependency } from '@/lib/monitoring/application-insights';
//   initApplicationInsights();
//
// The APPLICATIONINSIGHTS_CONNECTION_STRING environment variable must be set.
// When unset (e.g. in development), all calls are no-ops.
// ─────────────────────────────────────────────────────────────────────────────

let appInsightsClient: AppInsightsClient | null = null;

// Minimal interface — avoids hard dependency on @azure/monitor-opentelemetry in test environments.
interface AppInsightsClient {
  trackEvent(telemetry: { name: string; properties?: Record<string, unknown> }): void;
  trackException(telemetry: { exception: Error; properties?: Record<string, unknown> }): void;
  trackDependency(telemetry: {
    dependencyTypeName: string;
    name: string;
    duration: number;
    success: boolean;
    data?: string;
  }): void;
  trackMetric(telemetry: { name: string; value: number }): void;
  flush(): Promise<void>;
}

/**
 * Initialise Application Insights.
 * Must be called once at server startup (e.g. in instrumentation.ts or layout.tsx server setup).
 * No-op when APPLICATIONINSIGHTS_CONNECTION_STRING is not set.
 */
export function initApplicationInsights(): void {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString || typeof window !== "undefined") {
    // Not configured or running in browser — skip
    return;
  }

  try {
    // Dynamic import to avoid bundling the SDK in environments that don't need it.
    // The actual SDK (@azure/monitor-opentelemetry or applicationinsights) must be
    // installed separately when deploying to Azure.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ai = require("applicationinsights") as {
      setup: (cs: string) => { start: () => void };
      defaultClient: AppInsightsClient;
    };
    ai.setup(connectionString).start();
    appInsightsClient = ai.defaultClient;
  } catch {
    // SDK not installed — graceful degradation (logs to stdout instead)
    console.warn("Application Insights SDK not installed. Telemetry disabled.");
  }
}

/**
 * Track a custom event with optional properties.
 */
export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  appInsightsClient?.trackEvent({ name, properties });
}

/**
 * Track an exception/error.
 */
export function trackException(error: Error, properties?: Record<string, unknown>): void {
  appInsightsClient?.trackException({ exception: error, properties });
}

/**
 * Track a dependency call (e.g. LLM, vector store) with duration.
 */
export function trackDependency(options: {
  type: string;
  name: string;
  durationMs: number;
  success: boolean;
  data?: string;
}): void {
  appInsightsClient?.trackDependency({
    dependencyTypeName: options.type,
    name: options.name,
    duration: options.durationMs,
    success: options.success,
    data: options.data,
  });
}

/**
 * Track a custom metric (e.g. chunk count, similarity score).
 */
export function trackMetric(name: string, value: number): void {
  appInsightsClient?.trackMetric({ name, value });
}

/**
 * Flush pending telemetry (call before process exit).
 */
export async function flushTelemetry(): Promise<void> {
  await appInsightsClient?.flush();
}

/**
 * Check if Application Insights is configured and active.
 */
export function isMonitoringEnabled(): boolean {
  return appInsightsClient !== null;
}
