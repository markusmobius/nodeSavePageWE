// Opens a saved page with all network access blocked and reports what actually rendered.

async function inspectSaved(browser, html) {
    const page = await browser.newPage();
    const externalRequests = [];

    try {
        await page.setRequestInterception(true);
        page.on('request', request => {
            if (/^(data|about|blob):/.test(request.url())) request.continue();
            else { externalRequests.push(request.url()); request.abort(); }
        });

        await page.setContent(html, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);

        const result = await page.evaluate(() => {
            const loaded = img => !!img && img.complete && img.naturalWidth > 0;
            const isDataPng = img => !!img && (img.getAttribute('src') || '').startsWith('data:image/png;base64,');
            const out = {};

            out.cssInJs = getComputedStyle(document.querySelector('.cij')).color === 'rgb(1, 2, 3)';
            out.webFont = [...document.fonts].some(f => f.family.replace(/"/g, '') === 'TestFont' && f.status === 'loaded');
            out.cssBackgroundImage = /^url\("data:/.test(getComputedStyle(document.querySelector('.bg')).backgroundImage);
            out.adoptedStyleSheet = getComputedStyle(document.querySelector('.adopted')).color === 'rgb(7, 8, 9)';
            out.adoptedBackgroundImage = /^url\("data:/.test(getComputedStyle(document.querySelector('.adoptedbg')).backgroundImage);
            const inner = document.getElementById('shadowhost')?.shadowRoot?.querySelector('.inner');
            out.shadowAdoptedStyleSheet = !!inner && getComputedStyle(inner).color === 'rgb(10, 11, 12)';
            const closedRoot = document.getElementById('closedhost')?.shadowRoot;
            out.closedShadowDom = !!closedRoot && /Headline in closed shadow DOM/.test(closedRoot.textContent) && loaded(closedRoot.getElementById('closedimg'));
            for (const id of ['normal', 'slow', 'hotlink', 'lazy', 'datasrc']) out['img_' + id] = loaded(document.getElementById(id));

            const many = [...document.querySelectorAll('img[data-savepage-src*="many"]')];
            out.manyImages = many.filter(loaded).length + '/' + many.length;

            const canvas = document.getElementById('cv');
            out.canvas = !!canvas && /^url\("data:image\/png/.test(getComputedStyle(canvas).backgroundImage);

            // Cross-origin frame: readable directly, or (when saved sandboxed) parsed from its srcdoc
            const xf = document.getElementById('xframe');
            let xd = xf && xf.contentDocument;
            const sandboxed = !xd && !!xf && xf.hasAttribute('srcdoc');
            if (sandboxed) xd = new DOMParser().parseFromString(xf.getAttribute('srcdoc'), 'text/html');
            const frameImg = id => { const img = xd && xd.getElementById(id); return sandboxed ? isDataPng(img) : loaded(img); };

            out.frameSandboxed = sandboxed;
            out.frameSaved = !!(xd && xd.querySelector('.fcij'));
            out.frameCssInJs = !!(xd && xd.querySelector('.fcij') && (sandboxed
                ? [...xd.querySelectorAll('style')].some(s => s.textContent.includes('rgb(4, 5, 6)'))
                : xd.defaultView.getComputedStyle(xd.querySelector('.fcij')).color === 'rgb(4, 5, 6)'));
            out.frameImg = frameImg('frameimg');
            out.dollarText = !!(xd && xd.getElementById('dollar') && xd.getElementById('dollar').textContent === "a$&b$'c$1");
            out.dollarImg = frameImg('dollarimg');

            const nf = xd && xd.getElementById('nested');
            let nd = nf && nf.contentDocument;
            if (!nd && nf && nf.hasAttribute('srcdoc')) nd = new DOMParser().parseFromString(nf.getAttribute('srcdoc'), 'text/html');
            out.nestedFrameImg = isDataPng(nd && nd.getElementById('nestedimg'));

            const sd = document.getElementById('sd');
            const sdd = sd && sd.contentDocument;
            out.srcdocFrame = !sd ? 'missing' : (sd.getAttribute('srcdoc') === '' ? 'blanked'
                : (sdd && sdd.querySelector('p.q') && sdd.querySelector('p.q').textContent === 'quoted' && loaded(sdd.getElementById('sdimg')) ? 'saved' : 'broken'));
            out.strayFrameText = document.body.innerText.includes('quoted');

            const adImg = document.getElementById('adimg');
            out.adImg = !adImg ? 'missing' : (loaded(adImg) ? 'saved' : (getComputedStyle(adImg).display === 'none' ? 'hidden' : 'broken'));
            const af = document.getElementById('adframe');
            out.adFrame = !af ? 'missing' : (af.contentDocument && af.contentDocument.getElementById('nestedimg') ? 'saved' : 'empty');
            const cookie = document.getElementById('AcceptCookie');
            out.cookieBanner = !cookie ? 'missing' : (getComputedStyle(cookie).display === 'none' ? 'hidden' : 'shown');
            out.chromeErrorPage = /ERR_BLOCKED_BY_CLIENT|has been blocked|chromewebdata/i.test(document.documentElement.outerHTML);

            out.title = document.querySelector('meta[name="savepage-title"]')?.getAttribute('content');
            out.version = document.querySelector('meta[name="savepage-version"]')?.getAttribute('content');
            return out;
        });

        result.externalRequests = externalRequests;
        return result;
    }
    finally {
        await page.close();
    }
}

module.exports = { inspectSaved };
