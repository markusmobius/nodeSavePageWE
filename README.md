# save-page-we

Save a complete web page, as currently displayed, as a single self-contained HTML file that opens in any browser, without network access. By default, cookie notices and pop-ups such as subscription prompts are left out, so the saved page can be read and scrolled.

This is a Node.js port of the [Save Page WE](https://chromewebstore.google.com/detail/save-page-we/dhhpefjklgkmgeafimnjhojgjamoafof) browser extension by DW-dev (version 33.6, March 2023). It runs the extension's page-saving code in headless Chrome with [Puppeteer](https://pptr.dev/). Images, fonts, stylesheets and frames are embedded in the saved file. Scripts are kept but disabled, so the saved page shows the page as it was.

**[See example pages](https://markusmobius.github.io/nodeSavePageWE/)** saved from CBS News, The Guardian, Politico and USA Today, with and without lazy loading and at each blocking level.

## Installation

```
npm install save-page-we
```

This also installs [Puppeteer](https://pptr.dev/) and a compatible version of Chrome. Node.js 22.12 or later is required.

Newer npm versions don't run the install scripts of packages, which Puppeteer uses to download Chrome. In that case Chrome is downloaded the first time you save a page (one time, about 200 MB; progress is shown on stderr). If an earlier download was interrupted, the leftover is removed and Chrome is downloaded again. To download it in advance instead, run `npx puppeteer browsers install chrome`. Set the environment variable `PUPPETEER_SKIP_DOWNLOAD=true` to turn the download off.

On Linux (including WSL), Chrome needs some system libraries that aren't always installed. If one is missing, the error shows the command that installs them (it needs `sudo`), for example:

```
sudo apt-get satisfy -y --no-install-recommends "$(paste -sd, ~/.cache/puppeteer/chrome/linux-<version>/chrome-linux64/deb.deps)"
```

## Usage

```js
const { savePage } = require('save-page-we');

savePage('https://www.nytimes.com', {
    path: 'nytimes.html',      // file to write the saved page to
    adblock: 'annoyances',     // 'none', 'annoyances' (default), 'simple' or 'extended' - see below
    loadLazyContent: false     // true: scroll through the page first so lazy-loaded content is saved
}).then(result => {
    console.log(`saved ${result.resources} resources, ${result.failed.length} failed`);
}).catch(error => {
    console.error(error.message);
});
```

All options are listed under [Options](#options).

`savePage()` returns a promise that resolves to:

| Property | Description |
|---|---|
| `html` | The saved page (also written to `path` if given) |
| `resources` | Number of external resources found |
| `failed` | `[{ url, reason }]` for resources that could not be loaded (e.g. `load:404`, `maxtime`, `maxsize`, `mixed`) |
| `skipped` | `[{ url, size }]` for resources left out because they exceed `maxResourceSize` |
| `blockedRequests` | Number of requests blocked (see `adblock`) |
| `blockedHosts` | Host names of blocked requests |

The promise rejects if the page cannot be loaded, the save fails, the total size exceeds `maxTotalSize`, or `timeout` expires. The browser is always closed.

`scrape({ url, ...options })`, the function name used by earlier versions, still works and does the same.

TypeScript type definitions are included.

### Saving many pages

Each call to `savePage()` launches its own browser unless you pass one in. To save many pages, launch a browser once with `launch()` (which applies the required Chrome flags) and pass it as `browser`. It is left open for you to close. If you launch the browser yourself, set Puppeteer's `protocolTimeout` to `0` or to more than `timeout`; otherwise slow pages fail after Puppeteer's default of 180 seconds.

```js
const { launch, savePage } = require('save-page-we');

async function saveAll(urls) {
    const browser = await launch();
    try {
        for (const [i, url] of urls.entries()) {
            await savePage(url, { path: `page${i}.html`, browser });
        }
    } finally {
        await browser.close();
    }
}
```

## Command line

```
npx savepagewe https://www.nytimes.com -o nytimes.html --adblock simple
```

| Option | Description |
|---|---|
| `-o, --output <file>` | Write the saved page to `<file>` (default: write the HTML to stdout) |
| `-a, --adblock <level>` | `none`, `annoyances` (default), `simple` or `extended` |
| `-l, --lazy-load` | Scroll through the page to load lazy content first |
| `--timeout <ms>`, `--delay <ms>` | Overall time limit, extra wait before saving |
| `--max-resource-size <mb>`, `--max-resource-time <s>` | Limits for each resource |
| `--user-agent <string>`, `--viewport <WxH>` | Browser settings |
| `--format-html`, `--include-summary` | Indent the HTML, add a timings and resources comment |
| `--json` | Print the report as JSON |
| `-q, --quiet` | Don't print the report |

The report goes to stdout when `--output` is given, otherwise to stderr. The exit code is 0 when the page was saved, 1 when the save failed and 2 for invalid arguments. This makes the command easy to call from other languages.

## Blocking pop-ups, ads and trackers

The `adblock` option sets what is blocked while the page loads:

| `adblock` | Blocks |
|---|---|
| `'none'` | Nothing - the page is saved exactly as displayed, including any cookie notice or pop-up that was open |
| `'annoyances'` (default) | Cookie notices and pop-ups such as subscription and newsletter prompts. Ads are kept. |
| `'simple'` | Ads and trackers |
| `'extended'` | Ads, trackers and annoyances, plus the [StevenBlack hosts list](https://github.com/StevenBlack/hosts) (about 70,000 ad and malware hosts) |

Pop-ups matter because saved pages don't run scripts: a pop-up that was open when the page was saved can't be closed, and the page behind it often can't be scrolled.

Blocking uses the [Ghostery adblocker](https://github.com/ghostery/adblocker), which is installed with this package, with the [EasyList](https://easylist.to/), EasyPrivacy, EasyList Cookie and [uBlock Origin](https://github.com/uBlockOrigin/uAssets) filter lists.

```js
savePage('https://www.politico.com', { path: 'politico.html', adblock: 'simple' });
```

Blocking ads also leaves out ad frames, tracking pixels and empty ad boxes, and saving is often several times faster on ad-heavy news sites. Elements hidden by the filter lists stay hidden in the saved page, and images that were blocked are saved hidden instead of broken. The page being saved is never blocked. The filter lists include fixes for common anti-adblock scripts, so sites like USA Today don't show an "ad blocker detected" message.

The lists are downloaded when first used, cached for 24 hours in the system temp folder, and kept in memory for the life of the process. If they cannot be downloaded, an out-of-date copy is used.

## Options

Options are passed as the second argument of `savePage(url, options)`, or together with `url` in a single object.

| Option | Default | Description |
|---|---|---|
| `path` | | File to write the saved page to |
| `browser` | | Browser from `launch()` to reuse (not closed by `savePage()`) |
| `timeout` | `300000` | Overall time limit in ms |
| `navigationTimeout` | `180000` | Time limit for loading the page in ms |
| `waitUntil` | | Puppeteer `waitUntil` for navigation. By default it waits for `DOMContentLoaded`, then up to `loadTimeout` ms for the `load` event |
| `loadTimeout` | `30000` | See `waitUntil` |
| `imageTimeout` | `10000` | Maximum wait in ms for images (including lazy images released before saving) to finish loading |
| `delay` | `0` | Extra wait in ms before saving (for pages that keep rendering after load) |
| `viewport` | `{ width: 1600, height: 10000 }` | Browser viewport |
| `userAgent` | browser's own | User agent string. By default the browser's own, without "Headless" |
| `adblock` | `'annoyances'` | `'none'`, `'annoyances'`, `'simple'` or `'extended'` (see above) |
| `loadLazyContent` (or `lazyload`) | `false` | Scroll through the page to trigger lazy-loaded content before saving |
| `lazyLoadType` | `0` | `0` = scroll page, `1` = shrink page |
| `lazyLoadMaxTime` | `60` | Maximum seconds spent loading lazy content (stops infinite-scroll pages) |
| `loadLazyImages` | `true` | Force loading of images using `loading="lazy"` or lazy-load libraries (`data-src`, etc.) |
| `savedItems` | `1` | `0` = basic, `1` = standard, `2` = custom (see `saveHTML*`/`saveCSS*` options) |
| `saveHTMLImagesAll`, `saveHTMLAudioVideo`, `saveHTMLObjectEmbed`, `saveCSSImagesAll`, `saveCSSFontsWoff`, `saveCSSFontsAll`, `saveScripts` | | Custom saved items (with `savedItems: 2`) |
| `maxResourceSize` | `50` | Maximum size of one resource in MB |
| `maxTotalSize` | `250` | Maximum total size of all resources in MB |
| `maxResourceTime` | `10` | Maximum seconds to load one resource |
| `maxConcurrentLoads` | `12` | Maximum number of resources loaded at the same time |
| `maxFrameDepth` | `5` | Maximum depth of nested frames to save |
| `includeSummary` | `false` | Append a comment with timings and a resource list to the saved page |
| `formatHTML` | `false` | Indent the saved HTML |
| `executeScripts` | `false` | Allow scripts in the saved page to run. If `false`, `<script>` elements and inline event handlers (`onload` etc.) are kept but disabled |
| `debugEnable` | `false` | Log progress to the page console |

`retainCrossFrames`, `mergeCSSImages`, `removeUnsavedURLs`, `removeElements`, `rehideElements`, `allowPassive`, `crossOrigin` and `swapDevices` are also accepted and behave as in the extension.

## How it works

Save Page WE is the best and fastest single-page HTML saver I have found, but headless Chrome cannot run it as an extension. The extension consists of a background script, which handles the Save button and loads resources, and content scripts, which run in the page, collect its images, fonts, stylesheets and frames, and generate the saved HTML.

This package replaces the background script with Node.js code and keeps the content scripts:

* `lib/index.js` controls Chrome with Puppeteer: it loads the page, waits for it to finish loading, runs the page scripts and fetches resources the page itself cannot fetch (for example because of CORS or hotlink protection), like the extension's background script.
* `lib/page/save-page.js` is based on the extension's `content.js`. It is injected into the main frame, collects all resources and generates the saved HTML.
* `lib/page/capture-frame.js` is based on the extension's `content-frame.js`. It runs in every frame, including cross-origin frames the main frame cannot read. It records CSS-in-JS rules, canvas contents and fonts, and the HTML of those frames.
* `lib/adblock.js` blocks pop-ups, ads and trackers.

The original extension code is in [`upstream/save-page-we-33.6`](upstream/save-page-we-33.6) for reference.

## Contributing

Contributions are welcome. See [DEVELOPMENT.md](DEVELOPMENT.md) for running the tests and publishing releases.

## License

GNU General Public License version 2, like the original Save Page WE extension by DW-dev. See [LICENSE](LICENSE).

I am mostly using this code for saving news websites.
