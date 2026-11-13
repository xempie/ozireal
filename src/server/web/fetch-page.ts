import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Read a public web page for the assistant (owner's request, 2026-11-12): the agent
 * pastes a listing link (a developer's page, a portal, an agency site) and the assistant
 * reads it the way it reads a pasted screenshot.
 *
 * Safety, because the server is the one fetching:
 *   - http(s) only, standard ports, no credentials in the URL;
 *   - every hop's host is resolved and refused if it points inside a private, loopback,
 *     link-local or cloud-metadata range (SSRF), redirects followed by hand, at most 4;
 *   - 12 s timeout, 2 MB cap, HTML or text only.
 * It returns facts, not markup: title, description, main image, any schema.org JSON-LD,
 * and the visible text, trimmed. Nothing is stored.
 */

const MAX_BYTES = 2_000_000;
const MAX_TEXT = 45_000;

function privateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return true;
    const m = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return m ? privateAddress(m[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function assertPublic(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http and https links can be read.");
  if (url.username || url.password) throw new Error("Links with a username or password are not read.");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("That link uses an unusual port and was not read.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error("That address is not on the public internet.");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => privateAddress(a.address))) throw new Error("That address is not on the public internet.");
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

function meta(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decode(c).trim() : null;
}

export type WebPage = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  structuredData: unknown[];
  text: string;
  truncated: boolean;
};

export async function fetchPage(raw: string): Promise<WebPage> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("That is not a valid link.");
  }

  let res: Response | null = null;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; OziRealtyCRM/1.0; +https://www.ozirealty.com.au)",
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        "accept-language": "en-AU,en;q=0.9",
      },
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url);
      continue;
    }
    break;
  }
  if (!res) throw new Error("The page could not be read.");
  if (res.status === 403 || res.status === 429)
    throw new Error(
      `${url.hostname} refused automated reading (HTTP ${res.status}). Big portals such as realestate.com.au and domain.com.au usually do. Paste a screenshot or the listing text instead.`,
    );
  if (!res.ok) throw new Error(`The page answered HTTP ${res.status}.`);
  const type = res.headers.get("content-type") ?? "";
  if (!/html|text\/plain|xml/i.test(type)) throw new Error(`That link is a ${type.split(";")[0] || "file"}, not a web page.`);

  // Read at most MAX_BYTES.
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.length;
      if (size > MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
  }
  const html = new TextDecoder("utf-8").decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));

  const structuredData: unknown[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      structuredData.push(JSON.parse(m[1].trim()));
    } catch {
      /* broken JSON-LD on their page: skip it */
    }
    if (structuredData.length >= 5) break;
  }

  const title = meta(html, "og:title") ?? (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)![1]).trim() : null);
  const imageRaw = meta(html, "og:image") ?? meta(html, "twitter:image");
  const text = decode(
    html
      .replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

  return {
    url: url.toString(),
    title,
    description: meta(html, "og:description") ?? meta(html, "description"),
    image: imageRaw ? new URL(imageRaw, url).toString() : null,
    structuredData,
    text: text.slice(0, MAX_TEXT),
    truncated: text.length > MAX_TEXT,
  };
}
