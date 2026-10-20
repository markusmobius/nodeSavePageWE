/************************************************************************/
/*                                                                      */
/*      Ad and annoyance blocking for save-page-we                      */
/*                                                                      */
/*      Uses the Ghostery adblocker (@ghostery/adblocker-puppeteer,     */
/*      MPL-2.0) with EasyList/uBlock Origin style filter lists, and    */
/*      for 'extended' also https://github.com/StevenBlack/hosts        */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*                                                                      */
/************************************************************************/

const fs = require('fs');
const os = require('os');
const path = require('path');

const PACKAGE = '@ghostery/adblocker-puppeteer';

// Unified hosts file (adware + malware)
const STEVENBLACK_HOSTS_URL = 'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts';

// prebuilt: a Ghostery prebuilt engine; annoyances: only the annoyance lists of Ghostery's full set (there is no
// prebuilt engine for them); hosts: also block the hosts in the StevenBlack hosts list
const LEVELS = {
    annoyances: { prebuilt: null, annoyances: true, hosts: false },                         // cookie notices and pop-ups such as subscription prompts - ads are kept
    simple: { prebuilt: 'fromPrebuiltAdsAndTracking', annoyances: false, hosts: false },    // ads and trackers
    extended: { prebuilt: 'fromPrebuiltFull', annoyances: false, hosts: true }              // ads, trackers, annoyances and the StevenBlack hosts list
};

// Change when LEVELS change, so blockers cached on disk by an earlier version are not used
const CACHE_VERSION = 2;

// Annoyance lists in Ghostery's full set: EasyList Cookie, uBlock Origin Annoyances (cookies and others)
const ANNOYANCE_LISTS = /easylist-cookie|annoyances-/;

const CACHE_DIR = path.join(os.tmpdir(), 'nodesavepagewe-adblock');
const CACHE_TTL = 24 * 60 * 60 * 1000;  // refresh lists once a day
const DOWNLOAD_TIMEOUT = 60000;

// Entries at the top of hosts files that must never be blocked
const IGNORED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'local', 'broadcasthost', '0.0.0.0',
    'ip6-localhost', 'ip6-loopback', 'ip6-localnet', 'ip6-mcastprefix', 'ip6-allnodes', 'ip6-allrouters', 'ip6-allhosts']);

const memoryCache = new Map();  // level -> Promise<PuppeteerBlocker>

// Loaded only when ad blocking is used, so saves without it don't pay for loading the adblocker
function ghostery() {
    return require(PACKAGE);
}

/**
 * Parse a hosts file ("0.0.0.0 ads.example.com") into a list of host names.
 */
function parseHosts(text) {
    const hosts = new Set();

    for (let line of text.split(/\r?\n/)) {
        const hash = line.indexOf('#');
        if (hash >= 0) line = line.slice(0, hash);

        const tokens = line.trim().split(/\s+/).filter(Boolean);
        if (tokens.length === 0) continue;

        // IP address followed by one or more host names, or just a host name
        const names = (tokens.length > 1 && /^[0-9.]+$|:/.test(tokens[0])) ? tokens.slice(1) : tokens;

        for (const name of names) {
            const host = name.toLowerCase().replace(/\.$/, '');
            if (host && !IGNORED_HOSTS.has(host)) hosts.add(host);
        }
    }

    return [...hosts];
}

async function buildBlocker(level) {
    const { PuppeteerBlocker, fullLists } = ghostery();
    const { prebuilt, annoyances, hosts } = LEVELS[level];
    const engines = [];

    if (prebuilt) engines.push(await PuppeteerBlocker[prebuilt](fetch));

    if (annoyances) {
        const urls = fullLists.filter(url => ANNOYANCE_LISTS.test(url));
        if (urls.length === 0) throw new Error('No annoyance lists found in the Ghostery adblocker');
        engines.push(await PuppeteerBlocker.fromLists(fetch, urls));
    }

    if (hosts) {
        const response = await fetch(STEVENBLACK_HOSTS_URL, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT) });
        if (response.status !== 200) throw new Error(`HTTP ${response.status} for ${STEVENBLACK_HOSTS_URL}`);

        // A listed host also blocks its subdomains, like ad blockers do
        const filters = parseHosts(await response.text()).map(host => '||' + host + '^');
        engines.push(PuppeteerBlocker.parse(filters.join('\n'), { loadCosmeticFilters: false }));
    }

    if (engines.length === 1) return engines[0];

    // Engines may carry different versions of the resources (scriptlets and stub scripts) - keep those of the first
    const merged = PuppeteerBlocker.merge(engines, { skipResources: true });
    merged.resources = engines[0].resources;

    return merged;
}

// Built blockers are cached on disk for a day; out-of-date lists are used if they cannot be downloaded
async function loadCached(level) {
    const { PuppeteerBlocker } = ghostery();
    const cacheFile = path.join(CACHE_DIR, `${level}-v${CACHE_VERSION}.bin`);

    let stale = null;
    try {
        const stat = await fs.promises.stat(cacheFile);
        const engine = PuppeteerBlocker.deserialize(new Uint8Array(await fs.promises.readFile(cacheFile)));

        if (Date.now() - stat.mtimeMs < CACHE_TTL) return engine;
        stale = engine;
    }
    catch (e) { }  // no cache, or written by an incompatible version of the adblocker

    try {
        const engine = await buildBlocker(level);

        await fs.promises.mkdir(CACHE_DIR, { recursive: true });
        await fs.promises.writeFile(cacheFile, engine.serialize());

        return engine;
    }
    catch (e) {
        if (stale) return stale;

        throw new Error(`Cannot download ad block lists (${level}): ${e.message}`);
    }
}

/**
 * Blocker for the given level ('annoyances', 'simple' or 'extended'), loaded once per process.
 */
function loadAdblocker(level) {
    if (!LEVELS[level]) throw new TypeError(`adblock must be one of: 'none', ${Object.keys(LEVELS).map(l => `'${l}'`).join(', ')}`);

    if (!memoryCache.has(level)) {
        const loading = loadCached(level);
        memoryCache.set(level, loading);
        loading.catch(() => memoryCache.delete(level));  // retry next time
    }
    return memoryCache.get(level);
}

// Map a saved resource's expected MIME type (from the page script) to a request type for filter matching
function requestType(mimeType) {
    if (mimeType === 'text/css') return 'stylesheet';
    if (mimeType === 'application/font-woff') return 'font';
    if (mimeType === 'text/javascript') return 'script';
    if (/^image\//.test(mimeType)) return 'image';
    if (/^(audio|video)\//.test(mimeType)) return 'media';
    return 'other';
}

/**
 * True if the blocker would block (or replace) this resource - used for resources fetched from Node.
 */
function isBlockedResource(blocker, url, sourceUrl, mimeType) {
    const { Request } = ghostery();

    const { match, redirect } = blocker.match(Request.fromRawDetails({ url, sourceUrl, type: requestType(mimeType) }));

    return match === true || redirect !== undefined;
}

module.exports = { loadAdblocker, isBlockedResource, parseHosts, LEVELS };
