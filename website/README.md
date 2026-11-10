# Brandon Books & Stories — Website and PWA

The website is the public bookstore and author home for Brandon D. Coleman Jr.

## Mobile app foundation

This folder now includes the first Progressive Web App (PWA) foundation:

- `manifest.webmanifest` defines the installable app identity and standalone display mode.
- `sw.js` caches the public app shell and book detail pages, provides an offline fallback, refreshes the book catalog from the network when online, and limits runtime cache growth.
- `app.js` registers the service worker, supports the Android install prompt when the browser offers it, provides iPhone/iPad Add to Home Screen guidance, saves the selected color theme locally, and offers a user-controlled update when a new app version is ready.
- `assets/bbs-app-icon.svg` is the scalable app mark; optimized 192 px and 512 px PNG icons support Android install surfaces, and a 180 px Apple touch icon supports iPhone/iPad.
- `offline.html` provides a clear offline message.
- `book-6.html` and `book-7.html` add detail pages for the final two published series installments.
- `privacy.html` and `terms.html` describe the current app behavior and retailer handoff.

## Reader features

- Search and filter the seven-book catalog.
- Save favorites locally on the current device.
- Switch between light and dark themes.
- Open confirmed Amazon product links where present.
- Use retailer search links for Books 6 and 7 while direct product listings are not yet verified.
- Submit reader reviews through the existing website API and connected Discord review bridge.

Favorites and theme preferences are stored in browser local storage; they are not account-based and do not synchronize between devices.

## Publishing data rules

Do not invent titles, book descriptions, covers, ISBNs, ASINs, prices, format status, release dates, or direct retailer product URLs. The author confirmed all seven series books are published on Amazon. Direct listing and edition-specific details for Books 6 and 7 still need to be verified. Their detail pages therefore use retailer search links and explicitly identify the missing official cover artwork.

Amazon's automated public-page checks may return service errors. A failed automated check is not proof that a listing is unavailable and must not remove a previously configured purchase link.

Barnes & Noble and TikTok Shop product links should only be promoted as purchase links after the specific product listing or shop URL is confirmed. Search results must be labeled as searches, not verified product pages.

## Local testing

Serve this directory over HTTPS or localhost. Open `index.html`, verify the app manifest and service worker in the browser's application/developer tools, test search and favorites, switch themes, and test offline navigation after the first successful load.

The Vercel project currently uses this `website` directory as its static site root. Changes are kept on a feature branch until approved; do not merge or publish them without the author's approval.
