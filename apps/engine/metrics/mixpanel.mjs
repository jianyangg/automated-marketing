// Mixpanel Segmentation Query API: one event, counted per day in the
// project's time zone. type "unique" counts distinct users, which for an event
// like task_started is the "active users" north star. Authentication is HTTP
// Basic with a service account. Limit: 60 queries per hour.
// https://docs.mixpanel.com/reference/segmentation-query
const HOSTS = {
  us: "https://mixpanel.com",
  eu: "https://eu.mixpanel.com",
  in: "https://in.mixpanel.com",
};

export function mixpanelReader({ credentials, fetch = globalThis.fetch }) {
  return {
    // Returns { "YYYY-MM-DD": count } for each day Mixpanel reports. A day it
    // does not report is left absent (unknown), never filled in as zero.
    async daily(metric, fromDate, toDate) {
      const { username, secret } = credentials(metric.secret);
      const query = new URLSearchParams({
        project_id: String(metric.projectId),
        event: metric.event,
        from_date: fromDate,
        to_date: toDate,
        unit: "day",
        type: metric.type,
      });
      const response = await fetch(`${HOSTS[metric.region]}/api/query/segmentation?${query}`, {
        headers: {
          authorization: `Basic ${Buffer.from(`${username}:${secret}`).toString("base64")}`,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(30_000),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(`Mixpanel HTTP ${response.status}: ${body?.error ?? "request failed"}`);
      const counts = body?.data?.values?.[metric.event] ?? {};
      return Object.fromEntries(Object.entries(counts).filter(([, value]) => Number.isFinite(value)));
    },
  };
}
