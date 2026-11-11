import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Script } from "node:vm";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const website = resolve(root, "website");
const failures = [];
const pass = message => console.log("PASS", message);
const fail = message => failures.push(message);
const read = path => readFileSync(resolve(root, path), "utf8");

const manifest = JSON.parse(read("website/manifest.webmanifest"));
if (manifest.name !== "Brandon Books & Stories" || manifest.display !== "standalone") {
  fail("PWA manifest identity or display mode is incorrect.");
} else pass("PWA manifest identity and standalone display mode");

for (const icon of manifest.icons || []) {
  const path = resolve(website, icon.src);
  if (!existsSync(path)) fail("Missing manifest icon: " + icon.src);
  else pass("Manifest icon exists: " + icon.src);
}
if (!(manifest.icons || []).some(icon => icon.sizes === "192x192") ||
    !(manifest.icons || []).some(icon => icon.sizes === "512x512")) {
  fail("Manifest must include 192x192 and 512x512 PNG icons.");
}

const sw = read("website/sw.js");
const shellMatch = sw.match(/const APP_SHELL = (\[[\s\S]*?\]);/);
if (!shellMatch) {
  fail("Could not read the service-worker app shell.");
} else {
  const shell = JSON.parse(shellMatch[1]);
  for (const item of shell) {
    const path = resolve(website, item);
    if (!existsSync(path)) fail("Missing service-worker shell asset: " + item);
  }
  pass("All " + shell.length + " service-worker shell paths exist");
}
if (!sw.includes('event.data.type === "SKIP_WAITING"') ||
    sw.includes(".then(() => self.skipWaiting())")) {
  fail("Service-worker updates must wait for reader approval.");
} else pass("Service-worker updates wait for reader approval");
if (!sw.includes('new URL("./offline.html", self.location.href).href')) {
  fail("Offline fallback URL must be absolute and resolvable.");
} else pass("Offline fallback URL resolution");

for (const file of ["website/app.js", "website/sw.js", "website/settings.js"]) {
  const result = spawnSync(process.execPath, ["--check", resolve(root, file)], { encoding: "utf8" });
  if (result.status !== 0) fail(file + " syntax check failed: " + (result.stderr || result.stdout));
  else pass(file + " syntax");
}

const catalog = JSON.parse(read("website/books.json"));
if (catalog.books.length !== 7) fail("Book catalog must contain all seven titles.");
if (catalog.books.some(book => book.formats || book.editions)) {
  fail("Edition-specific format status and pricing metadata must not be stored in the public catalog.");
} else pass("Catalog contains no edition-specific format status or pricing metadata");

const botSource = read("index.js");
if (/Kindle ASIN|Paperback ASIN|LIVE — \\$5\\.99|LIVE — \\$20\\.00/.test(botSource)) {
  fail("Discord publishing announcement still contains removed Book 1 edition details.");
} else pass("Discord publishing announcement has no removed edition prices or ASIN details");

const index = read("website/index.html");
const inlineScripts = [...index.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1]).filter(code => code.trim());
for (let i = 0; i < inlineScripts.length; i++) {
  try { new Script(inlineScripts[i]); }
  catch (error) { fail("Inline homepage script " + (i + 1) + " failed: " + error.message); }
}
pass("Homepage inline scripts compile");

if ((index.match(/class="book-card/g) || []).length !== 7) fail("Homepage must display seven book cards.");
else pass("Seven book cards are present");
if (!index.includes('data-book-filter="favorites"') ||
    !index.includes('data-book-filter="published"') ||
    index.includes("data-edition-status") || index.includes("editionStatus")) {
  fail("Catalog filters must use published status and favorites, without edition-progress metadata.");
} else pass("Catalog search, published filter, and favorites without edition-status metadata");
if (!index.includes('href="settings.html"')) fail("Homepage is missing the App Settings link.");
else pass("App Settings navigation");
if (index.includes('class="cover cover-')) fail("Unverified mock cover artwork remains on the homepage.");
else pass("Homepage does not present mock covers as official artwork");

for (let number = 1; number <= 7; number++) {
  const path = "website/book-" + number + ".html";
  const page = read(path);
  if (!page.includes('data-favorite-book="book-' + number + '"')) fail("Book " + number + " is missing its favorite control.");
  if (!page.includes("Official cover artwork not yet provided")) fail("Book " + number + " is missing its official-cover placeholder.");
  if (!page.includes('rel="manifest"') || !page.includes('rel="apple-touch-icon"')) {
    fail("Book " + number + " is missing PWA metadata.");
  }
}
pass("All seven detail pages have favorites, cover safeguards, and PWA metadata");

const settings = read("website/settings.html");
const settingsJs = read("website/settings.js");
if (!settings.includes('id="clear-favorites"') || !settings.includes('id="theme-toggle"') ||
    !settingsJs.includes('removeItem("bbs-favorites")')) {
  fail("App Settings controls are incomplete.");
} else pass("App Settings controls and favorites clearing");

if (failures.length) {
  console.error("\nPWA verification failed:");
  for (const failure of failures) console.error(" -", failure);
  process.exitCode = 1;
} else {
  console.log("\nPWA verification passed.");
}
