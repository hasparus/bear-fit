import { type } from "arktype";
import { getServerByName } from "partyserver";

import type { Env } from "./worker";

import { IsoDate } from "../app/schemas";

/**
 * Link-preview fetchers. They don't run JavaScript, so they only see the
 * calendar if the HTML carries it. Signal fetches previews as "WhatsApp".
 */
const CRAWLER =
  /bot|facebookexternalhit|whatsapp|preview|embedly|mastodon|cardyb|crawler|spider/i;

const TAGLINE = "find a time that works for everybody";

/** Just what the preview shows; older calendars may lack other fields. */
const PreviewEvent = type({
  "endDate?": IsoDate,
  name: "string > 0",
  "rolling?": "number.integer > 0",
  "startDate?": IsoDate,
});
type PreviewEvent = typeof PreviewEvent.infer;

/**
 * Serves `index.html`. People get the static file untouched; crawlers opening
 * a calendar link get its name and dates in the title and Open Graph tags.
 */
export async function serveIndex(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const id = url.searchParams.get("id");
  const userAgent = request.headers.get("User-Agent") ?? "";
  if (!id || !CRAWLER.test(userAgent)) return env.ASSETS.fetch(request);

  const [response, event] = await Promise.all([
    env.ASSETS.fetch(request),
    getCalendarEvent(env, id),
  ]);
  if (!event) return response;

  const dates = describeDates(event);
  const description = dates ? `${dates} · ${TAGLINE}` : TAGLINE;
  return new HTMLRewriter()
    .on("title", {
      element: (element) => {
        element.setInnerContent(`${event.name} · bear-fit`);
      },
    })
    .on('meta[name="description"], meta[property="og:description"]', {
      element: (element) => {
        element.setAttribute("content", description);
      },
    })
    .on('meta[property="og:title"]', {
      element: (element) => {
        element.setAttribute("content", event.name);
      },
    })
    .transform(response);
}

async function getCalendarEvent(env: Env, id: string) {
  try {
    const stub = await getServerByName(env.main, id);
    const event = PreviewEvent(await stub.getEvent());
    return event instanceof type.errors ? null : event;
  } catch (error) {
    console.error("failed to read calendar for link preview", error);
    return null;
  }
}

const dateRange = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

/** "Nov 6 – Dec 10, 2026", or "Next 14 days" for a rolling calendar. */
export function describeDates(event: PreviewEvent): string | undefined {
  if (event.rolling) return `Next ${event.rolling} days`;
  if (!event.startDate || !event.endDate) return undefined;
  return dateRange.formatRange(
    new Date(event.startDate),
    new Date(event.endDate),
  );
}
