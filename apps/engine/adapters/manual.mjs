// The fallback route when no provider API is commissioned: the engine reserves
// the send and holds the account, a person posts the exact content, and
// `receipt` records the live URL. It never claims a post went out by itself.
export const manualAdapter = {
  async publish() {
    return { state: "handoff" };
  },
  async lookup() {
    return { state: "unknown" };
  },
};
