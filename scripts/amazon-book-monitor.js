#!/usr/bin/env node
const fs = require("node:fs/promises");
const path = require("node:path");

const DATA_FILE = path.join(process.cwd(), "website", "books.json");

function clean(value) {
  return String(value || "").replace(/\\s+/g, " ").trim();
}

function parseBetween(html, start, end) {
  const a = html.indexOf(start);
  if (a < 0) return "";
  const b = html.indexOf(end, a + start.length);
  if (b < 0) return "";
  return html.slice(a + start.length, b);
}

function stripTags(value) {
  return clean(String(value || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " "));
}

function extractFirst(html, patterns) {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return clean(match[1].replace(/\\u0026/g, "&"));
  }
  return "";
}

async function checkAmazon(book) {
  if (!book.amazon?.asin) {
    return {
      availability: "not configured",
      checkedAt: new Date().toISOString(),
      note: "No Amazon ASIN has been configured yet."
    };
  }

  const url = `https://www.amazon.com/dp/${book.amazon.asin}`;
  const checkedAt = new Date().toISOString();

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    const html = await response.text();
    const blocked = /robot check|captcha|enter the characters you see below|sorry, we just need to make sure you're not a robot/i.test(html);

    if (blocked) {
      return {
        availability: "temporarily blocked",
        checkedAt,
        url,
        httpStatus: response.status,
        note: "Amazon requested a verification page. The next scheduled check will try again."
      };
    }

    const title = extractFirst(html, [
      /<span[^>]+id=["']productTitle["'][^>]*>([\\s\\S]*?)<\\/span>/i,
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    ]);

    const availabilityRaw =
      extractFirst(html, [
        /<div[^>]+id=["']availability["'][^>]*>([\\s\\S]*?)<\\/div>/i,
        /<span[^>]+id=["']availability["'][^>]*>([\\s\\S]*?)<\\/span>/i
      ]) || "";

    const price = extractFirst(html, [
      /<span[^>]+class=["'][^"']*a-price-whole[^"']*["'][^>]*>([\\s\\S]*?)<\\/span>/i
    ]);

    const image = extractFirst(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    ]);

    const listingFound =
      response.ok &&
      title &&
      /my life story with grandma/i.test(title);

    return {
      availability: listingFound ? "available" : "not detected",
      checkedAt,
      url,
      httpStatus: response.status,
      title: title || null,
      price: price ? stripTags(price) : null,
      image: image || null,
      amazonAvailabilityText: stripTags(availabilityRaw) || null,
      note: listingFound
        ? "Amazon listing detected automatically."
        : "Amazon listing was not confidently detected yet."
    };
  } catch (error) {
    return {
      availability: "check failed",
      checkedAt,
      url,
      note: clean(error.message)
    };
  }
}

(async () => {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const data = JSON.parse(raw);
  const now = new Date().toISOString();

  for (const book of data.books || []) {
    if (book.amazon?.asin) {
      console.log(`Checking ${book.id} (${book.amazon.asin})...`);
      book.amazonCheck = await checkAmazon(book);
      if (book.amazonCheck.availability === "available") {
        book.amazon.url = `https://www.amazon.com/dp/${book.amazon.asin}`;
        book.amazon.listingDetected = true;
      } else {
        book.amazon.listingDetected = false;
      }
    } else {
      book.amazonCheck = await checkAmazon(book);
      book.amazon.listingDetected = false;
    }
  }

  data.lastChecked = now;
  data.monitor = {
    enabled: true,
    interval: "Every 30 minutes",
    source: "Amazon public product pages",
    behavior: "When an Amazon listing is detected, the website can automatically surface its direct Amazon link."
  };

  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
  console.log(`Amazon monitor finished at ${now}`);
})();
