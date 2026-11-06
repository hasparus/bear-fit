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
 * Serves `/` and the card images: `/og.png?id=<calendar>&v=<version>`. Other
 * paths aren't link previews, so they get `null`.
 */
export function routeLinkPreview(
  request: Request,
  env: Env,
): Promise<Response> | null {
  const url = new URL(request.url);
  if (url.pathname === "/") return serveIndex(request, env, url);
  const id = url.searchParams.get("id");
  if (url.pathname === "/og.png" && id) return serveCardImage(env, url, id);
  return null;
}

/**
 * People get the static `index.html` untouched; crawlers opening a calendar
 * link get its name, dates and card image in the title and Open Graph tags.
 */
async function serveIndex(request: Request, env: Env, url: URL) {
  const id = url.searchParams.get("id");
  const userAgent = request.headers.get("User-Agent") ?? "";
  if (!id || !CRAWLER.test(userAgent)) return env.ASSETS.fetch(request);

  const [response, event] = await Promise.all([
    env.ASSETS.fetch(request),
    getCalendarEvent(env, id),
  ]);
  if (!event) return response;

  const dates = describeDates(event);
  const description = [dates, TAGLINE].filter(Boolean).join(" · ");
  const image = new URL("/og.png", url);
  image.searchParams.set("id", id);
  image.searchParams.set("v", cardVersion(event.name, dates));
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
        // A serialized URL has no quotes or angle brackets; `&` is escaped.
        head.append(
          `<meta property="og:image" content="${image.href.replaceAll("&", "&amp;")}" />` +
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
 * The image's URL carries the card's version, so a rename or new dates gets
 * a new URL and each URL's image can be cached for good.
 */
async function serveCardImage(env: Env, url: URL, id: string) {
  const [card, event] = await Promise.all([
    loadCard(env.ASSETS, url.origin),
    getCalendarEvent(env, id),
  ]);
  if (!event) return new Response("Not Found", { status: 404 });

  const png = await renderCard(card, event.name, describeDates(event));
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
function cardVersion(name: string, dates: string) {
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

/**
 * "Nov 6 – Dec 10, 2026", "Next 14 days" for a rolling calendar, or "" when
 * the calendar has no dates.
 */
function describeDates(event: PreviewEvent): string {
  if (event.rolling) return `Next ${event.rolling} days`;
  if (!event.startDate || !event.endDate) return "";
  return dateRange.formatRange(
    new Date(event.startDate),
    new Date(event.endDate),
  );
}
