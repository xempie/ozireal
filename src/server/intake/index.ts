import { registerAdapter, registeredChannels } from "./types";
import { webFormAdapter } from "./adapters/web-form";
import { emailAdapter } from "./adapters/email";
import { manualAdapter } from "./adapters/manual";

/**
 * Adapter registration — the one place a new channel gets added (§5). Social DMs,
 * portal enquiry emails and the customer app each land here as one import and one
 * line when their phase arrives.
 */
if (registeredChannels().length === 0) {
  registerAdapter(webFormAdapter);
  registerAdapter(emailAdapter);
  registerAdapter(manualAdapter);
}

export { ingestThrough, ingestNormalised, type IngestResult } from "./pipeline";
export { resolveContact, type Resolution } from "./resolve";
export * from "./types";
