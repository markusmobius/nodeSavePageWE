# Changelog

## 1.0.4

### Fixed
- Clearer output when Chrome has to be set up: the error messages for a missing Chrome or missing system libraries are only the explanation and the command to run (Puppeteer's original error is still available as `error.puppeteerError`), and Puppeteer's confusing "Skipping ... download" notes are hidden.
- The README's usage example handles errors, so failures print just the message.

## 1.0.3

### Fixed
- The automatic Chrome download only downloads Chrome (about 200 MB), not also Puppeteer's chrome-headless-shell (125 MB), which isn't used.
- A Chrome download that was interrupted earlier no longer blocks the next one: the leftover folder is deleted and Chrome is downloaded again.
- Chrome can be unpacked without the `unzip` program, which isn't installed on all Linux systems (adds the `yauzl` dependency).
- If Chrome can't start because system libraries are missing (common on WSL and minimal Linux installs), the error shows the command that installs them.

## 1.0.2

### Changed
- If Chrome for Puppeteer is not installed, it is downloaded automatically the first time a page is saved. Newer npm versions skip Puppeteer's own install script, which normally downloads it. Set `PUPPETEER_SKIP_DOWNLOAD=true` to turn this off.
- The example script and the README's usage example show the main options (`adblock`, `loadLazyContent`).

## 1.0.1

### Fixed
- When Chrome for Puppeteer is missing, the error now explains how to install it (`npx puppeteer browsers install chrome`). Newer npm versions don't run the install scripts of packages, which Puppeteer uses to download Chrome. The README's Installation section explains this too.

## 1.0.0

First release as the npm package `save-page-we` (previously used from the GitHub repository `nodeSavePageWE`).

### Changed
- New API `savePage(url, options)`. `scrape({ url, ... })` still works.
- Requires Node.js 22.12 or later (required by Puppeteer 25).
- Waits for the page's load event, fonts and images before saving, which saves noticeably more images and fonts.

### Added
- Command line tool `savepagewe`.
- Blocking with the Ghostery adblocker, which is installed with the package: `adblock: 'none' | 'annoyances' | 'simple' | 'extended'`. The default `'annoyances'` leaves out cookie notices and pop-ups such as subscription prompts, which can't be closed in a saved page, and keeps ads.
- Options for all extension settings and timeouts; result report with failed, skipped and blocked resources.
- Reusing a browser across saves with `launch()` and the `browser` option.
- Resources the page cannot fetch (CORS, hotlink protection) are fetched again from Node.
- TypeScript type definitions and automated tests.

### Fixed
- Saves no longer hang: errors in the page reject the promise, there is an overall timeout, and the browser is always closed.
- Cross-origin frames are captured even when the browser enforces web security.
- Images could be saved empty when the browser chose a different `srcset` image after resources were loaded.
- Page content containing `$&`, `$'` or quotes could corrupt saved frames and attributes.
- Styles from constructable style sheets (`document.adoptedStyleSheets`, also in shadow roots) are now saved. Pages and components that use them were saved without those styles.
- Content in closed shadow DOM is now saved. Web components that use it, such as the headline lists on USA Today, were saved empty.
- Pages that reload themselves while being saved (some news sites do after a few minutes without user activity) no longer make the save fail.
- Saved pages no longer run inline event handlers, unsaved frames or failed stylesheets, which could load content from the network.
- Resource loads are limited to 12 at a time and time out only after they start, so busy pages no longer lose images.
