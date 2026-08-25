import { load } from "cheerio";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import type { CleanSnapshot, PassageDraft, ScopePreview } from "./knowledgeTypes";

const MAX_PAGE_BYTES = 1_500_000;
const MAX_PREVIEW_LINKS = 180;
const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT = "CodexKnowledgePreview/1.0 (+source-grounded collection builder)";

function isBlockedIp(address: string) {
  const value = address.toLowerCase();
  if (value === "::1" || value === "::" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return false;
  const [a, b] = value.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    a >= 224
  );
}

export function canonicalizeUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.username = "";
  url.password = "";
  for (const key of Array.from(url.searchParams.keys())) {
    if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
  }
  if (url.pathname !== "/" && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
  return url.toString();
}

export async function assertPublicWebsiteUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete public website URL, including https://.");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only public http and https websites can be imported.");
  if (url.username || url.password) throw new Error("Website URLs with embedded credentials are not allowed.");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error("Local network addresses cannot be imported.");
  const addresses = await lookup(url.hostname, { all: true, verbatim: true }).catch(() => []);
  if (addresses.length === 0) throw new Error("The website host could not be resolved.");
  if (addresses.some((entry) => isBlockedIp(entry.address))) throw new Error("Private or reserved network addresses cannot be imported.");
  return new URL(canonicalizeUrl(url.toString()));
}

function scopeRules(value: string) {
  return value
    .split(/[\n,]+/)
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => (rule.startsWith("/") ? rule : `/${rule}`));
}

export function matchesScope(url: string, includeRules: string, excludeRules: string) {
  const path = new URL(url).pathname;
  const includes = scopeRules(includeRules);
  const excludes = scopeRules(excludeRules);
  const allowedByInclude = includes.length === 0 || includes.some((rule) => path.startsWith(rule));
  const blockedByExclude = excludes.some((rule) => path.startsWith(rule));
  return allowedByInclude && !blockedByExclude;
}

async function fetchWithPolicy(value: string, accept = "text/html,application/xhtml+xml") {
  let current = await assertPublicWebsiteUrl(value);
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        headers: { accept, "user-agent": USER_AGENT },
        signal: controller.signal,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("The website sent a redirect without a destination.");
        current = await assertPublicWebsiteUrl(new URL(location, current).toString());
        continue;
      }
      const length = Number(response.headers.get("content-length") || "0");
      if (length > MAX_PAGE_BYTES) throw new Error("This page is larger than the import safety limit.");
      if (!response.ok) throw new Error(`The website returned HTTP ${response.status}.`);
      return { response, url: current };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("The website redirected too many times.");
}

async function robotsAllows(url: URL) {
  const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
  try {
    const { response } = await fetchWithPolicy(robotsUrl, "text/plain,*/*");
    const text = (await response.text()).slice(0, 180_000);
    const lines = text.split(/\r?\n/);
    let applies = false;
    const disallow: string[] = [];
    for (const raw of lines) {
      const line = raw.replace(/#.*/, "").trim();
      const [key, ...rest] = line.split(":");
      const value = rest.join(":").trim();
      if (!key) continue;
      if (key.toLowerCase() === "user-agent") {
        applies = value === "*" || value.toLowerCase().includes("codexknowledgepreview");
      }
      if (applies && key.toLowerCase() === "disallow" && value) disallow.push(value);
    }
    return !disallow.some((rule) => rule === "/" || url.pathname.startsWith(rule));
  } catch {
    return true;
  }
}

function textFromHtml(html: string, baseUrl: string) {
  const $ = load(html);
  $("script, style, noscript, svg, canvas, iframe, nav, footer, header, aside, form").remove();
  const root = $("main, article, [role=main]").first();
  const body = root.length ? root : $("body");
  const title = $("title").first().text().trim() || $("h1").first().text().trim() || new URL(baseUrl).hostname;
  const headings: Array<{ level: number; text: string; anchor: string }> = [];
  const headingPath: string[] = [];
  body.find("h1,h2,h3,h4,h5,h6").each((index, element) => {
    const name = element.tagName.toLowerCase();
    const level = Number(name.slice(1));
    const text = $(element).text().replace(/\s+/g, " ").trim();
    if (!text) return;
    const sourceId = $(element).attr("id");
    const anchor = sourceId ? `id:${sourceId}` : `text:${text.slice(0, 120)}`;
    headings.push({ level, text, anchor });
  });
  const text = body
    .text()
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_PAGE_BYTES);
  return { title, text, headings, headingPath };
}

export async function previewWebsiteScope(input: {
  seedUrl: string;
  includePaths: string;
  excludePaths: string;
  pageLimit: number;
}): Promise<ScopePreview> {
  const seed = await assertPublicWebsiteUrl(input.seedUrl);
  const allowed = await robotsAllows(seed);
  if (!allowed) throw new Error("The site’s robots policy does not allow this path to be imported.");
  const { response, url } = await fetchWithPolicy(seed.toString());
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("html")) throw new Error("The submitted URL did not return an HTML page.");
  const html = await response.text();
  const $ = load(html);
  const links = new Set<string>([canonicalizeUrl(url.toString())]);
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || links.size >= MAX_PREVIEW_LINKS) return;
    try {
      const next = new URL(href, url);
      if (next.hostname !== url.hostname || !/^https?:$/.test(next.protocol)) return;
      const normalized = canonicalizeUrl(next.toString());
      if (matchesScope(normalized, input.includePaths, input.excludePaths)) links.add(normalized);
    } catch {
      // Ignore malformed source links.
    }
  });
  const discoveredUrls = Array.from(links)
    .filter((link) => matchesScope(link, input.includePaths, input.excludePaths))
    .sort()
    .slice(0, Math.min(Math.max(input.pageLimit, 1), MAX_PREVIEW_LINKS))
    .map((link) => ({ url: link, path: new URL(link).pathname, selected: true }));
  return {
    seedUrl: canonicalizeUrl(url.toString()),
    host: url.hostname,
    discoveredUrls,
    estimatedPageCount: links.size,
    robotsNotice: "The preview follows the site’s robots policy and only shows same-host HTML links within your rules.",
  };
}

export async function scrapeSnapshot(value: string): Promise<CleanSnapshot> {
  const url = await assertPublicWebsiteUrl(value);
  const allowed = await robotsAllows(url);
  if (!allowed) throw new Error("The site’s robots policy does not allow this page to be imported.");
  const { response, url: resolved } = await fetchWithPolicy(url.toString());
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("html")) throw new Error("This source is not an HTML page.");
  const html = await response.text();
  const cleaned = textFromHtml(html, resolved.toString());
  if (cleaned.text.length < 80) throw new Error("The page did not contain enough readable public text to import.");
  return {
    canonicalUrl: canonicalizeUrl(resolved.toString()),
    title: cleaned.title,
    headings: cleaned.headings,
    text: cleaned.text,
    contentHash: createHash("sha256").update(cleaned.text).digest("hex"),
    fetchedAt: new Date(),
  };
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export function chunkSnapshot(snapshot: CleanSnapshot): PassageDraft[] {
  const paragraphs = snapshot.text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const headingStack: string[] = [];
  let headingIndex = 0;
  let position = 0;
  const passages: PassageDraft[] = [];
  for (const paragraph of paragraphs) {
    const matchingHeading = snapshot.headings.find((heading) => paragraph.startsWith(heading.text));
    if (matchingHeading) {
      headingIndex = snapshot.headings.indexOf(matchingHeading);
      headingStack.splice(Math.max(0, matchingHeading.level - 1));
      headingStack[matchingHeading.level - 1] = matchingHeading.text;
    }
    const anchor = snapshot.headings[headingIndex]?.anchor || `text:${paragraph.slice(0, 120)}`;
    for (let start = 0; start < paragraph.length; start += 850) {
      const text = paragraph.slice(start, start + 850).trim();
      if (text.length < 45) continue;
      passages.push({
        position,
        headingPath: headingStack.filter(Boolean).join(" / ") || "Page overview",
        anchor: start === 0 ? anchor : `text:${text.slice(0, 120)}`,
        text,
        contentHash: createHash("sha256").update(`${snapshot.contentHash}:${position}:${text}`).digest("hex"),
      });
      position += 1;
    }
  }
  return passages;
}
