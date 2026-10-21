/************************************************************************/
/*                                                                      */
/*      save-page-we - save a web page as a single HTML file            */
/*                                                                      */
/*      Based on: Save Page WE - Generic WebExtension - Background Page */
/*      Copyright (C) 2016-2023 DW-dev                                  */
/*                                                                      */
/*      Adapted for Node/Puppeteer by Markus Mobius                     */
/*      markusmobius@gmail.com                                          */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*      See LICENSE file and http://www.gnu.org/licenses/               */
/*                                                                      */
/************************************************************************/

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { loadAdblocker, isBlockedResource } = require('./adblock');
const { version } = require('../package.json');

// Scripts injected into the page being saved (see lib/page/)
const SAVE_PAGE_SCRIPT = path.join(__dirname, 'page', 'save-page.js');
const CAPTURE_FRAME_EXPRESSION = '(function () {\n' + fs.readFileSync(path.join(__dirname, 'page', 'capture-frame.js'), 'utf8') + '\nreturn savepage_captureFrame();\n})()';

// Web security is disabled so that the page script can fetch cross-origin resources and read
// cross-origin frames. Chrome only honours one --disable-features switch, so all features are in one.
const BROWSER_ARGS = [
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process,BlockInsecurePrivateNetworkRequests',
    '--disable-site-isolation-trials',
    '--proxy-server=direct://',
    '--proxy-bypass-list=*'
];

const DEFAULTS = {
    timeout: 300000,            // overall time limit for one page (ms)
    navigationTimeout: 180000,  // time limit for page.goto (ms)
    waitUntil: null,            // puppeteer waitUntil for page.goto - null: DOMContentLoaded, then wait up to loadTimeout for the load event
    loadTimeout: 30000,         // max time to wait for the load event after DOMContentLoaded (ms)
    fontTimeout: 10000,         // max time to wait for document.fonts.ready (ms)
    imageTimeout: 10000,        // max time to wait for images to finish loading before saving (ms)
    frameTimeout: 10000,        // max time to capture each frame (ms)
    delay: 0,                   // extra time to wait before saving (ms)
    viewport: { width: 1600, height: 10000 },
    userAgent: null,            // null: the browser's own user agent without "Headless"
    adblock: 'annoyances'       // 'none', 'annoyances' (cookie notices and pop-ups, ads kept), 'simple' (ads and trackers) or 'extended' (all, plus the StevenBlack hosts list)
};

const CLOSE_TIMEOUT = 10000;  // max time to close a page or browser after saving (ms)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Launch a browser configured for saving pages. Pass the result as the `browser` option
 * to save several pages without starting a new browser each time.
 *
 * If Chrome for Puppeteer is not installed, it is downloaded the first time (see downloadChrome).
 *
 * @param {object} [options] - Puppeteer launch options; `args` are added to the required Chrome flags
 */
async function launch(options = {}) {
    const puppeteer = require('puppeteer');
    const start = () => puppeteer.launch({
        headless: true,
        // No per-call protocol limit - savePage() enforces its own overall `timeout` (the 180 s default would cut long saves short)
        protocolTimeout: 0,
        ...options,
        args: [...BROWSER_ARGS, ...(options.args || [])]
    });

    try {
        return await start();
    }
    catch (e) {
        if (!isChromeMissing(e) || options.executablePath) throw e;

        // Newer npm versions don't run the install scripts of packages, so Puppeteer's Chrome download may not have happened
        if (!/^(1|true|yes)$/i.test(process.env.PUPPETEER_SKIP_DOWNLOAD || '')) {
            try {
                await downloadChrome();
                return await start();
            }
            catch (retryError) {
                if (!isChromeMissing(retryError)) throw retryError;
            }
        }

        throw new Error('Chrome for Puppeteer is not installed. Install it with:\n\n  npx puppeteer browsers install chrome\n\n' +
            'Newer npm versions skip the install scripts of packages, which Puppeteer uses to download Chrome.\n\n' + e.message, { cause: e });
    }
}

function isChromeMissing(error) {
    return /Could not find (Chrome|Chromium)/i.test(error && error.message);
}

let chromeDownload = null;

// Runs Puppeteer's own installer (the install script npm skipped) - once per process, even if several launches need it.
// Its progress goes to stderr, so it doesn't mix with saved HTML written to stdout.
function downloadChrome() {
    if (!chromeDownload) {
        process.stderr.write('save-page-we: Chrome for Puppeteer is not installed - downloading it (one time, about 150 MB)...\n');

        const installer = path.join(path.dirname(require.resolve('puppeteer/package.json')), 'install.mjs');
        chromeDownload = new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [installer], { stdio: ['ignore', 2, 2] });
            child.on('error', reject);
            child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Chrome download failed (exit code ${code})`)));
        });
        chromeDownload.catch(() => { chromeDownload = null; });  // allow another attempt later
    }
    return chromeDownload;
}

/**
 * Save a web page as a single self-contained HTML file.
 *
 * @param {string|object} url - URL of the page, or an options object that includes `url`
 * @param {object} [options] - { path?, browser?, adblock?, ... } (see README)
 * @returns {Promise<{html: string, resources: number, failed: Array<{url, reason}>, skipped: Array<{url, size}>, blockedRequests: number, blockedHosts: string[]}>}
 */
async function savePage(url, options = {}) {
    const task = (url !== null && typeof url == 'object') ? url : { ...options, url };

    if (typeof task.url != 'string' || task.url == '') throw new TypeError('savePage: url is required');

    const settings = { ...DEFAULTS };
    for (const [name, value] of Object.entries(task)) if (value !== undefined) settings[name] = value;

    const {
        url: pageUrl, path: outputPath, browser: suppliedBrowser,
        timeout, navigationTimeout, waitUntil, loadTimeout, fontTimeout, imageTimeout, frameTimeout, delay, viewport, userAgent, adblock,
        ...clientOptions
    } = settings;

    clientOptions.versionString = `save-page-we ${version}`;

    // Load filter lists before starting the browser so download errors are reported straight away
    const blocker = adblock === 'none' ? null : await loadAdblocker(adblock);

    const blocked = { requests: 0, hosts: new Set() };

    const browser = suppliedBrowser || await launch();
    let page, pageCreation, stopCounting, finished = false;

    try {
        const result = await withTimeout((async () => {
            pageCreation = browser.newPage();
            page = await pageCreation;
            return run();
        })(), timeout, `savePage: timed out after ${timeout} ms saving ${pageUrl}`);

        if (outputPath) await fs.promises.writeFile(outputPath, result.html);

        return {
            html: result.html,
            ...result.report,
            failed: result.report.failed.filter(failure => failure.reason != 'blocked'),
            blockedRequests: blocked.requests,
            blockedHosts: [...blocked.hosts].sort()
        };
    }
    finally {
        finished = true;
        if (stopCounting) stopCounting();

        // If the timeout expired while the page was being created, close it once it exists
        if (!page && pageCreation) page = await withTimeout(pageCreation, CLOSE_TIMEOUT, 'create page').catch(() => null);

        // Clean-up must not hang either (Puppeteer's own protocol timeout is disabled by launch())
        if (page) await withTimeout(page.close(), CLOSE_TIMEOUT, 'close page').catch(() => { });
        if (!suppliedBrowser) {
            await withTimeout(browser.close(), CLOSE_TIMEOUT, 'close browser').catch(() => {
                try { browser.process()?.kill('SIGKILL'); } catch (e) { }
            });
        }
    }

    async function run() {
        const ua = userAgent || (await browser.userAgent()).replace('HeadlessChrome', 'Chrome');

        await page.setUserAgent(ua);
        await page.setViewport(viewport);

        // Allow injected scripts to be executed
        await page.setBypassCSP(true);


        if (blocker) {
            stopCounting = await enableAdblock(page, blocker, blocked);
            if (finished) stopCounting();  // timed out meanwhile - don't leave listeners on the shared blocker
        }

        // Some pages reload themselves, e.g. news sites after a few minutes without user activity, which would
        // interrupt a long save - so once saving starts, the page is not allowed to navigate away
        let saving = false;
        await page.setRequestInterception(true);
        page.on('request', request => {
            if (request.isInterceptResolutionHandled()) return;

            // Cooperative interception (with priorities) so this works together with the ad blocker's request handler
            if (saving && request.isNavigationRequest() && request.frame() === page.mainFrame()) request.abort('aborted', 1).catch(() => { });
            else request.continue(request.continueRequestOverrides(), 0).catch(() => { });
        });

        // Fallback for resources the page itself cannot fetch (equivalent of the extension's background fetch).
        // Only usable while the page is being saved, not by the page's own scripts before or after.
        let nodeFetchAllowed = false;
        await page.exposeFunction('savepage_nodeFetch', async (resourceUrl, referer, maxTimeSecs, maxSizeMB, mimeType) =>
            nodeFetchAllowed ? nodeFetch(resourceUrl, referer, ua, maxTimeSecs, maxSizeMB, blocker && (target => isBlockedResource(blocker, target, pageUrl, mimeType))) : { error: 'disabled' });

        await page.goto(pageUrl, { timeout: navigationTimeout, waitUntil: waitUntil || 'domcontentloaded' });

        if (!waitUntil) {
            // Wait for images and fonts referenced by the initial document - but don't fail if the page never finishes loading
            await page.waitForFunction(() => document.readyState === 'complete', { timeout: loadTimeout }).catch(() => { });
        }

        await withTimeout(page.evaluate(() => document.fonts.ready.then(() => true)), fontTimeout, 'fonts').catch(() => { });

        if (delay > 0) await sleep(delay);

        saving = true;

        await page.addScriptTag({ path: SAVE_PAGE_SCRIPT });

        await page.evaluate(options => savepage_prepare(options), clientOptions);

        // Lazy images released by savepage_prepare choose their final source (currentSrc) while loading
        await page.waitForFunction(() => Array.from(document.images).every(img => img.complete), { timeout: imageTimeout, polling: 200 }).catch(() => { });

        await exposeClosedShadowRoots(page);

        const frames = await captureFrames(page, frameTimeout);

        nodeFetchAllowed = true;
        try {
            return await page.evaluate(frameData => savepage_save(frameData), frames);
        }
        finally {
            nodeFetchAllowed = false;
        }
    }
}

async function enableAdblock(page, blocker, blocked) {
    // Blocks requests (the page being saved is never blocked) and hides ad elements with injected styles, which are saved with the page
    await blocker.enableBlockingInPage(page);

    // Count requests that were blocked or replaced by a stub (e.g. a no-op ad script). The blocker is shared, so only count this page's requests.
    const count = request => {
        const details = request._originalRequestDetails;
        let frame = null;
        try { frame = details && details.frame(); } catch (e) { }
        if (!frame || frame.page() !== page) return;

        blocked.requests++;
        try { blocked.hosts.add(new URL(request.url).hostname); } catch (e) { }
    };

    blocker.on('request-blocked', count);
    blocker.on('request-redirected', count);

    return () => {
        blocker.unsubscribe('request-blocked', count);
        blocker.unsubscribe('request-redirected', count);
    };
}

// Shadow DOM created as "closed" (web components use it for content such as headline lists) can't be read by the
// page scripts that save the page. The DevTools protocol can see it, so give each closed shadow root to its host
// element as openOrClosedShadowRoot - the property the extension's save code reads (Firefox gives it to extensions).
// The page itself is not changed: its scripts still see closed shadow roots.
async function exposeClosedShadowRoots(page) {
    let cdp;
    try {
        cdp = await page.createCDPSession();
        const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });

        const closed = [];
        const walk = node => {
            for (const shadow of node.shadowRoots || []) {
                if (shadow.shadowRootType === 'closed') closed.push({ host: node.backendNodeId, shadow: shadow.backendNodeId });
                walk(shadow);
            }
            for (const child of node.children || []) walk(child);
            if (node.contentDocument) walk(node.contentDocument);
        };
        walk(root);

        await Promise.all(closed.map(async ({ host, shadow }) => {
            try {
                const [{ object: hostObject }, { object: shadowObject }] = await Promise.all([
                    cdp.send('DOM.resolveNode', { backendNodeId: host }),
                    cdp.send('DOM.resolveNode', { backendNodeId: shadow })
                ]);
                await cdp.send('Runtime.callFunctionOn', {
                    objectId: hostObject.objectId,
                    functionDeclaration: 'function (shadowRoot) { Object.defineProperty(this, "openOrClosedShadowRoot", { value: shadowRoot, configurable: true }); }',
                    arguments: [{ objectId: shadowObject.objectId }]
                });
            }
            catch (e) { }  // element removed meanwhile
        }));
    }
    catch (e) { }  // closed shadow DOM is then left out, as before
    finally {
        if (cdp) await cdp.detach().catch(() => { });
    }
}

async function captureFrames(page, frameTimeout) {
    // Frames whose navigation failed or was blocked show Chrome's error page - don't save that
    const frames = page.frames().filter(frame => !frame.detached && !frame.url().startsWith('chrome-error:'));

    const results = await Promise.all(frames.map(frame =>
        withTimeout(frame.evaluate(CAPTURE_FRAME_EXPRESSION), frameTimeout, 'frame').catch(() => null)));

    return results.filter(Boolean);
}

async function nodeFetch(resourceUrl, referer, userAgent, maxTimeSecs, maxSizeMB, isBlocked) {
    if (!/^https?:/i.test(resourceUrl)) return { error: 'scheme' };

    const maxBytes = maxSizeMB * 1024 * 1024;
    const headers = { 'User-Agent': userAgent, 'Accept': '*/*' };
    if (referer) headers['Referer'] = referer;

    try {
        const signal = AbortSignal.timeout(maxTimeSecs * 1000);
        let response;

        // Follow redirects manually so that redirects to blocked resources are not followed
        for (let redirects = 0; ; redirects++) {
            if (isBlocked && isBlocked(resourceUrl)) return { error: 'blocked' };

            response = await fetch(resourceUrl, { headers, redirect: 'manual', signal });

            const location = response.headers.get('location');
            if (response.status < 300 || response.status > 399 || !location || redirects >= 10) break;

            await response.body?.cancel().catch(() => { });
            resourceUrl = new URL(location, resourceUrl).href;
            if (!/^https?:/i.test(resourceUrl)) return { error: 'scheme' };
        }

        if (response.status !== 200) {
            await response.body?.cancel().catch(() => { });
            return { status: response.status };
        }

        if (+response.headers.get('content-length') > maxBytes) {
            await response.body?.cancel().catch(() => { });
            return { error: 'maxsize' };
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        if (buffer.length > maxBytes) return { error: 'maxsize' };

        return { status: 200, contentType: response.headers.get('content-type') || '', base64: buffer.toString('base64') };
    }
    catch (e) {
        return { error: (e.name === 'TimeoutError' || e.name === 'AbortError') ? 'maxtime' : 'network' };
    }
}

/**
 * Same as savePage(options) - kept for compatibility with earlier versions.
 */
function scrape(task) {
    return savePage(task);
}

module.exports = { savePage, scrape, launch };
