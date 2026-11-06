import { type } from "arktype";
import { getServerByName } from "partyserver";

import type { Env } from "./worker";

import { IsoDate } from "../app/schemas";
import { loadCard, renderCard } from "./ogImage";

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
  // The id is URL-encoded and the origin is a parsed URL's, so neither can
  // break out of the attribute.
  const image = `${url.origin}/og/${encodeURIComponent(id)}.png?v=${cardVersion(event.name, dates)}`;
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
    .on("head", {
      element: (head) => {
        head.append(
          `<meta property="og:image" content="${image}" />` +
            `<meta property="og:image:width" content="1200" />` +
            `<meta property="og:image:height" content="630" />` +
            `<meta name="twitter:card" content="summary_large_image" />`,
          { html: true },
        );
      },
    })
    .transform(response);
}

/**
 * Serves `/og/<id>.png`. Its URL carries the card's version, so a rename or
 * new dates gets a new URL and each URL's image can be cached for good.
 */
export async function serveCardImage(
  env: Env,
  url: URL,
  id: string,
): Promise<Response> {
  const [card, event] = await Promise.all([
    loadCard(env.ASSETS, url.origin),
    getCalendarEvent(env, id),
  ]);
  if (!event) return new Response("Not Found", { status: 404 });

  const png = await renderCard(card, event.name, describeDates(event) ?? "");
  return new Response(png, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/png",
    },
  });
}

/** Bump when the card's design changes, so crawlers refetch the image. */
const CARD_DESIGN = 1;

/** FNV-1a over what the card shows. */
function cardVersion(name: string, dates = "") {
  let hash = 0x811c9dc5;
  for (const char of `${CARD_DESIGN}\n${name}\n${dates}`) {
    hash = Math.imul(hash ^ char.codePointAt(0)!, 0x01000193);
  }
  return (hash >>> 0).toString(36);
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
