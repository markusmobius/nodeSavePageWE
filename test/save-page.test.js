const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer');

const { savePage, scrape, launch } = require('..');
const { startFixture } = require('./fixture/server');
const { inspectSaved } = require('./fixture/inspect');

let site, checker, browser;

before(async () => {
    site = await startFixture();
    checker = await puppeteer.launch({ headless: true });
    browser = await launch();
});

after(async () => {
    await browser?.close();
    await checker?.close();
    await site?.close();
});

// What a complete save of the fixture page looks like when opened offline, with the default adblock: 'annoyances'
// (the cookie banner is hidden, the ads on ads.localhost are kept)
const COMPLETE = {
    cssInJs: true, webFont: true, cssBackgroundImage: true,
    adoptedStyleSheet: true, adoptedBackgroundImage: true, shadowAdoptedStyleSheet: true, closedShadowDom: true,
    img_normal: true, img_slow: true, img_hotlink: true, img_lazy: true, img_datasrc: true,
    manyImages: '40/40', canvas: true,
    frameSaved: true, frameCssInJs: true, frameImg: true, dollarText: true, dollarImg: true, nestedFrameImg: true,
    srcdocFrame: 'saved', strayFrameText: false,
    adImg: 'saved', adFrame: 'saved', cookieBanner: 'hidden', chromeErrorPage: false,
    externalRequests: []
};

function assertSaved(saved, overrides = {}) {
    const expected = { ...COMPLETE, ...overrides };
    for (const [key, value] of Object.entries(expected)) {
        if (value !== undefined) assert.deepEqual(saved[key], value, key);
    }
}

test('saves a complete, self-contained page', async () => {
    const file = path.join(os.tmpdir(), `save-page-we-test-${process.pid}.html`);
    try {
        const result = await savePage(site.base + '/', { path: file });

        assert.equal(fs.readFileSync(file, 'utf8'), result.html);
        assert.deepEqual(result.failed, [{ url: site.base + '/missing.css', reason: 'load:404' }]);
        assert.deepEqual(result.skipped, []);
        assert.equal(result.blockedRequests, 0);
        assert.ok(result.resources > 40);

        const saved = await inspectSaved(checker, result.html);
        assertSaved(saved, { frameSandboxed: false });
        assert.equal(saved.title, 'Fixture "quoted" title');
        assert.match(saved.version, /^save-page-we \d+\.\d+\.\d+/);
    }
    finally {
        fs.rmSync(file, { force: true });
    }
});

test('saves cross-origin frames in a browser with normal web security', async () => {
    const secure = await puppeteer.launch({ headless: true });
    try {
        const result = await savePage({ url: site.base + '/', browser: secure });

        assert.equal(secure.connected, true, 'a supplied browser is left open');

        // Cross-origin frames are captured separately and saved sandboxed, as in the extension.
        // The ad.localhost image and frame are not checked: with web security on they are fetched
        // from Node, which (unlike Chrome) does not resolve *.localhost host names.
        assertSaved(await inspectSaved(checker, result.html), { frameSandboxed: true, adImg: undefined, adFrame: undefined });
    }
    finally {
        await secure.close();
    }
});

test('reuses a browser from launch(), supports scrape() and caps lazy loading of infinite pages', async () => {
    const start = Date.now();
    const result = await scrape({ url: site.base + '/infinite', browser, lazyload: true, lazyLoadMaxTime: 3, viewport: { width: 1200, height: 800 } });

    assert.match(result.html, /start/);
    assert.ok(Date.now() - start < 30000, 'lazy loading stops after lazyLoadMaxTime');

    const second = await savePage(site.base + '/', { browser, loadLazyContent: true });
    assertSaved(await inspectSaved(checker, second.html));
    assert.equal(browser.connected, true);
});

test("adblock: 'none' saves the page exactly as displayed", async () => {
    const result = await savePage(site.base + '/', { browser, adblock: 'none' });

    assertSaved(await inspectSaved(checker, result.html), { cookieBanner: 'shown' });
    assert.equal(result.blockedRequests, 0);
});

test('a page that reloads itself during the save is still saved', async () => {
    const result = await savePage(site.base + '/reloading', { browser });

    assert.match(result.html, /Page that reloads itself/);
    assert.match(result.html, /<img id="slowimg"[^>]* src="data:image\/png;base64,/);
});

test('maxFrameDepth: 0 keeps frame content out of the saved page', async () => {
    const result = await savePage(site.base + '/', { browser, maxFrameDepth: 0 });
    const saved = await inspectSaved(checker, result.html);

    assert.equal(saved.frameSaved, false);
    assert.equal(saved.srcdocFrame, 'blanked');
    assert.deepEqual(saved.externalRequests, []);
});

test('executeScripts: true keeps scripts and event handlers active', async () => {
    const result = await savePage(site.base + '/', { browser, executeScripts: true });
    const saved = await inspectSaved(checker, result.html);

    // The <body onload> handler loads a beacon image from the original site
    assert.ok(saved.externalRequests.some(url => url.includes('/img/beacon.png')), JSON.stringify(saved.externalRequests));
});

test('maxResourceSize reports resources that are too large', async () => {
    const result = await savePage(site.base + '/', { browser, maxResourceSize: 0.01 });

    assert.ok(result.failed.some(failure => failure.url.endsWith('/font/testfont.woff2') && failure.reason === 'maxsize'), JSON.stringify(result.failed));
});

test('rejects invalid input and failed saves with clear errors', { timeout: 60000 }, async () => {
    await assert.rejects(savePage(), /url is required/);
    await assert.rejects(savePage({ path: 'x.html' }), /url is required/);
    await assert.rejects(savePage(site.base + '/', { browser, savedItems: 'standard' }), /Option 'savedItems' must be a number/);
    await assert.rejects(savePage(site.base + '/', { browser, adblock: true }), /adblock must be one of/);
    await assert.rejects(savePage(site.base + '/', { browser, maxTotalSize: 0.001 }), /exceeds maxTotalSize/);
    await assert.rejects(savePage(site.base + '/', { browser, timeout: 50 }), /timed out after 50 ms/);

    assert.equal(browser.connected, true);

    // Closing a page that was still being set up can take a few seconds on slow machines
    let pages;
    for (let wait = 0; wait < 30 && (pages = await browser.pages()).length > 1; wait++) await new Promise(resolve => setTimeout(resolve, 1000));
    assert.equal(pages.length, 1, 'pages are closed after errors');
});
