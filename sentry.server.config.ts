// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProd = process.env.NEXT_PUBLIC_APP_ENV === "production";

Sentry.init({
  dsn: "https://b0648a3d3f600a388d7cfeef892645bd@o4511472787128321.ingest.de.sentry.io/4511472801742928",
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  enabled: isProd,
  tracesSampleRate: isProd ? 0.1 : 1,
  enableLogs: true,
  sendDefaultPii: true,
});
