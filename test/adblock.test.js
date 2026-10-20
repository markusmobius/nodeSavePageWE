const { test } = require('node:test');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');

const { savePage } = require('..');
const { parseHosts, loadAdblocker, isBlockedResource } = require('../lib/adblock');
const { startFixture } = require('./fixture/server');
const { inspectSaved } = require('./fixture/inspect');

test('parses hosts files', () => {
    const hosts = parseHosts([
        '# comment',
        '127.0.0.1 localhost',
        '0.0.0.0 0.0.0.0',
        '0.0.0.0 ads.example.com tracker.example.com # trailing comment',
        '::1 ip6-localhost',
        'Plain.Example.org.',
        ''
    ].join('\n'));

    assert.deepEqual(hosts, ['ads.example.com', 'tracker.example.com', 'plain.example.org']);
});

test('levels block the right things', async () => {
    // Checked on a real domain: EasyList switches off generic hiding rules on localhost (@@://127.0.0.1$generichide)
    const page = { url: 'https://www.example.com/', hostname: 'www.example.com', domain: 'example.com' };
    const hidesCookieBanner = engine => /AcceptCookie/.test(engine.getCosmeticsFilters({
        ...page, ids: ['AcceptCookie'], classes: [], hrefs: [],
        getBaseRules: true, getInjectionRules: false, getExtendedRules: false, getRulesFromHostname: true, getRulesFromDOM: true
    }).styles);
    const blocks = (engine, url, type) => isBlockedResource(engine, url, page.url, type);

    const expected = {
        annoyances: { cookieBanner: true, ads: false, hostsList: false },
        simple: { cookieBanner: false, ads: true, hostsList: false },
        extended: { cookieBanner: true, ads: true, hostsList: true }
    };
    for (const [level, want] of Object.entries(expected)) {
        const engine = await loadAdblocker(level);
        assert.deepEqual({
            cookieBanner: hidesCookieBanner(engine),
            ads: blocks(engine, 'https://securepubads.g.doubleclick.net/tag/js/gpt.js', 'text/javascript'),
            hostsList: blocks(engine, 'https://ck.getcookiestxt.com/x', 'other')  // only in the StevenBlack list
        }, want, level);
        assert.equal(blocks(engine, 'https://www.example.com/image.jpg', 'image/png'), false, `${level} does not block the site itself`);
    }
});

test('ad blocking', { timeout: 300000 }, async (t) => {
    const site = await startFixture();
    const checker = await puppeteer.launch({ headless: true });
    t.after(async () => { await checker.close(); await site.close(); });

    await t.test('rejects unknown levels', async () => {
        await assert.rejects(savePage(site.base + '/', { adblock: 'strict' }), /adblock must be one of: 'none', 'annoyances', 'simple', 'extended'/);
    });

    for (const level of ['simple', 'extended']) {
        await t.test(`adblock: '${level}' blocks ads and keeps the page intact`, async () => {
            const result = await savePage(site.base + '/', { adblock: level });

            // EasyList blocks the ads.localhost ad script and frame
            assert.ok(result.blockedHosts.includes('ads.localhost'), JSON.stringify(result.blockedHosts));
            assert.ok(result.blockedRequests > 0);
            assert.ok(!result.failed.some(failure => failure.reason === 'blocked'), 'blocked resources are not reported as failed');

            const saved = await inspectSaved(checker, result.html);
            assert.equal(saved.chromeErrorPage, false, 'error pages of blocked frames are not saved');
            assert.notEqual(saved.adFrame, 'saved');
            assert.deepEqual(saved.externalRequests, []);
            for (const key of ['cssInJs', 'webFont', 'img_normal', 'img_hotlink', 'img_lazy', 'frameSaved', 'frameImg', 'nestedFrameImg']) {
                assert.equal(saved[key], true, key);
            }
        });
    }
});
