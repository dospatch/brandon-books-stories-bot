import fs from "node:fs";

const path = "website/books.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));
const now = new Date().toISOString();

function clean(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; BrandonBooksStoriesBot/1.0)",
      "accept-language": "en-US,en;q=0.9"
    },
    redirect: "follow"
  });
  return { status: response.status, url: response.url, text: await response.text() };
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? clean(match[1]) : "";
}

function extractPrice(html) {
  const match =
    html.match(/a-price-whole[^>]*>([^<]+)/i) ||
    html.match(/a-offscreen[^>]*>\s*([$£€]?[0-9.,]+)/i);
  return match ? clean(match[1]) : null;
}

function detectAvailability(html) {
  const lower = html.toLowerCase();
  if (/currently unavailable|out of stock|temporarily out of stock/.test(lower)) return "unavailable";
  if (/in stock|usually ships|available to ship|add to cart|buy now/.test(lower)) return "available";
  return "unknown";
}

const changes = [];

for (const book of data.books) {
  if (!book.amazon?.url && !book.amazon?.asin) {
    continue;
  }

  const url = book.amazon.url || `https://www.amazon.com/dp/${book.amazon.asin}`;

  try {
    const result = await fetchPage(url);
    const next = {
      checkedAt: now,
      httpStatus: result.status,
      finalUrl: result.url,
      title: extractTitle(result.text),
      price: extractPrice(result.text),
      availability: detectAvailability(result.text)
    };

    const before = JSON.stringify(book.amazonCheck || {});
    if (before !== JSON.stringify(next)) {
      book.amazonCheck = next;
      changes.push({ title: book.title, subtitle: book.subtitle, next });
    }
  } catch (error) {
    const next = {
      checkedAt: now,
      result: "check_failed",
      error: String(error?.message || error)
    };
    if (JSON.stringify(book.amazonCheck || {}) !== JSON.stringify(next)) {
      book.amazonCheck = next;
      changes.push({ title: book.title, subtitle: book.subtitle, next });
    }
  }
}

data.lastChecked = now;
fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");

if (changes.length && process.env.BOOK_UPDATES_WEBHOOK_URL && process.env.SOCIAL_WEBHOOK_SECRET) {
  for (const change of changes) {
    const n = change.next;
    const payload = {
      source: "book",
      id: `${change.title}-${change.subtitle}-${n.checkedAt || now}`,
      title: `${change.title} — ${change.subtitle}`,
      description:
        `Amazon listing check changed.\\n\\nStatus: ${n.availability || n.result || "updated"}` +
        (n.price ? `\\nPrice: ${n.price}` : ""),
      url: n.finalUrl || "https://www.amazon.com/",
      author: "Amazon Book Monitor"
    };

    const response = await fetch(process.env.BOOK_UPDATES_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Social-Webhook-Secret": process.env.SOCIAL_WEBHOOK_SECRET
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Book update webhook returned HTTP ${response.status}`);
    }
  }
}

console.log(`Amazon monitor complete: ${data.books.length} books checked; ${changes.length} record(s) changed.`);
