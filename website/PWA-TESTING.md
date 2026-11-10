# Brandon Books & Stories PWA — Manual Test Plan

Run these checks on the Vercel preview before approving a production release. A successful Vercel build and HTTP 200 responses do not replace real-device installation and offline testing.

## Android — Chrome

- [ ] Open the preview URL in Chrome on Android.
- [ ] Confirm the page title and Brandon Books & Stories app icon are correct.
- [ ] Use Chrome's Install app prompt or menu → Install app / Add to Home screen.
- [ ] Launch the installed app from the Android launcher.
- [ ] Confirm the app opens in standalone mode and the icon is not a generic browser icon.
- [ ] Open the home page, a book detail page, and App Settings.
- [ ] Change the theme, navigate to another page, and confirm the choice persists.
- [ ] Save a favorite from a book detail page; return to the bookstore and filter to My favorites.
- [ ] Clear favorites from App Settings and confirm the favorites filter is empty.
- [ ] While online, visit the home page, all seven book pages, App Settings, Privacy, and Terms.
- [ ] Turn on Airplane Mode and revisit those previously loaded pages.
- [ ] Restore connectivity. When a new service-worker version is deployed, confirm the Update app button appears and that tapping it refreshes the app.

## iPhone / iPad — Safari

- [ ] Open the preview URL in Safari.
- [ ] Open Share → Add to Home Screen.
- [ ] Confirm the Apple touch icon and Brandon Books title appear.
- [ ] Launch from the Home Screen.
- [ ] Confirm the app opens as a Home Screen web app.
- [ ] Test theme persistence, favorites, page navigation, and offline launch.
- [ ] Test an update after a new service-worker version is deployed.

## Storefront and reader flows

- [ ] Search the catalog for a title and confirm the correct card appears.
- [ ] Test All books, Published, Editions in progress, and My favorites filters.
- [ ] Open each of the seven book detail pages.
- [ ] Confirm Books 1–5 use the catalog's configured Amazon product URLs.
- [ ] Confirm Books 6–7 clearly identify their Amazon links as search links until direct product URLs are verified.
- [ ] Confirm no unverified Barnes & Noble or TikTok Shop listing is presented as a direct purchase link.
- [ ] Confirm no checkout or payment-card form is present.
- [ ] Submit a test reader review only after the webhook is configured; use non-sensitive test text and verify the review reaches the moderation destination.
- [ ] Confirm Discord support, Privacy, Terms, and App Settings links open correctly.

## Release gates

- [ ] No JavaScript syntax errors in inline scripts, `app.js`, `settings.js`, or `sw.js`.
- [ ] Manifest JSON parses and all referenced icon files load.
- [ ] Service-worker install precache succeeds with no missing shell assets.
- [ ] Offline fallback works after a real offline test.
- [ ] No production deployment, branch merge, or public release without the author's approval.
