import { manualAdapter } from "./manual.mjs";
import { threadsAdapter } from "./threads.mjs";
import { mixpanelReader } from "../metrics/mixpanel.mjs";
import { readSecret } from "../secrets.mjs";
import { EngineError } from "../store.mjs";

// Builds adapters only for channels the brand configured. A channel with no
// entry fails with `no_adapter` rather than pretending to send.
export function channelAdapters(config, { secrets = readSecret } = {}) {
  const adapters = {};
  if (config.channels.threads) {
    const key = config.channels.threads.secret;
    adapters.threads = threadsAdapter({
      account: config.channels.threads.account,
      credentials: () => {
        const value = secrets(key);
        if (typeof value.userId !== "string" || typeof value.accessToken !== "string")
          throw new EngineError("invalid_secret", `Keychain item ${key} needs {"userId", "accessToken"}.`);
        return value;
      },
    });
  }
  return adapters;
}

export function metricReaders({ secrets = readSecret } = {}) {
  return {
    mixpanel: mixpanelReader({
      credentials: (key) => {
        const value = secrets(key);
        if (typeof value.username !== "string" || typeof value.secret !== "string")
          throw new EngineError("invalid_secret", `Keychain item ${key} needs {"username", "secret"}.`);
        return value;
      },
    }),
  };
}

export { manualAdapter };
