// Local test site for save-page-we.
//
// Two servers on random ports give a main origin and a cross-origin (both 127.0.0.1, different ports).
// The pages contain the cases that have broken saving in the past: cross-origin and nested frames,
// CSS-in-JS rules, constructable style sheets, closed shadow DOM, web fonts, lazy and slow images, an image only served to plain <img> loads,
// inline event handlers, `$` and quote characters in frame content, a missing stylesheet, a cookie banner,
// and ad elements on ads.localhost (Chrome resolves *.localhost to the loopback address).

const http = require('http');
const fs = require('fs');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const FONT = fs.readFileSync(require.resolve('@fontsource/roboto/files/roboto-latin-400-normal.woff2'));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function mainPage(base, crossBase, adBase) {
    let manyImgs = '';
    for (let i = 0; i < 40; i++) manyImgs += `<img src="/img/many${i}.png" width="10" height="10">`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fixture "quoted" title</title>
<style>
@font-face { font-family: "TestFont"; src: url("/font/testfont.woff2") format("woff2"); }
.font { font-family: "TestFont", serif; }
.bg { background-image: url("/img/bg.png"); width: 20px; height: 20px; }
</style>
<style id="cssinjs" data-styled="active"></style>
<link rel="stylesheet" href="/missing.css">
<script>
  document.getElementById("cssinjs").sheet.insertRule(".cij { color: rgb(1, 2, 3); }", 0);
</script>
</head><body onload="var b=document.createElement('img');b.src='${base}/img/beacon.png?'+Date.now();document.body.appendChild(b)">
<p class="cij font">CSS-in-JS + web font text</p>
<p class="adopted">Constructable style sheet</p>
<div class="adoptedbg"></div>
<div id="shadowhost"></div>
<script>
  const sheet = new CSSStyleSheet();
  sheet.replaceSync('.adopted { color: rgb(7, 8, 9); } .adoptedbg { background-image: url("/img/adoptedbg.png"); width: 20px; height: 20px; }');
  document.adoptedStyleSheets = [sheet];
  const shadow = document.getElementById("shadowhost").attachShadow({ mode: "open" });
  shadow.innerHTML = '<span class="inner">Shadow DOM text</span>';
  const shadowSheet = new CSSStyleSheet();
  shadowSheet.replaceSync('.inner { color: rgb(10, 11, 12); }');
  shadow.adoptedStyleSheets = [shadowSheet];
</script>
<closed-widget id="closedhost"></closed-widget>
<script>
  // Web component with closed shadow DOM, like the headline lists of some news sites
  customElements.define("closed-widget", class extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({ mode: "closed" });
      root.innerHTML = '<a class="headline" href="/story/1">Headline in closed shadow DOM</a><img id="closedimg" src="/img/closedimg.png">';
    }
  });
</script>
<div class="bg"></div>
<img id="normal" src="/img/normal.png">
<img id="slow" src="/img/slow.png">
<img id="hotlink" src="/img/hotlink.png">
<div>${manyImgs}</div>
<canvas id="cv" width="20" height="20"></canvas>
<script>var c=document.getElementById("cv").getContext("2d");c.fillStyle="red";c.fillRect(0,0,20,20);</script>
<iframe id="xframe" src="${crossBase}/frame" width="300" height="200"></iframe>
<iframe id="sd" srcdoc="<p class=&quot;q&quot; title=&quot;a&quot;>quoted</p><img id=&quot;sdimg&quot; src=&quot;/img/srcdocimg.png?x=1&quot;>"></iframe>
<img id="adimg" src="${adBase}/img/ad.png">
<iframe id="adframe" src="${adBase}/nested" width="100" height="50"></iframe>
<script src="${adBase}/ad.js"></script>
<div id="AcceptCookie" style="position: fixed; bottom: 0; left: 0; right: 0; height: 60px; background: #333; color: #fff;">This site uses cookies</div>
<div style="height:30000px"></div>
<img id="lazy" loading="lazy" src="/img/lazy.png">
<img id="datasrc" data-src="/img/datasrc.png">
</body></html>`;
}

function framePage() {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style id="frame-cssinjs"></style>
<script>document.getElementById("frame-cssinjs").sheet.insertRule(".fcij { color: rgb(4, 5, 6); }", 0);</script>
</head><body>
<p class="fcij">Cross-origin frame</p>
<p id="dollar">a$&amp;b$'c$1</p>
<img id="dollarimg" src="/img/dollar.png?x=$&amp;y=$'">
<img id="frameimg" src="/img/frameimg.png">
<iframe id="nested" src="/nested" width="100" height="50"></iframe>
</body></html>`;
}

function nestedPage() {
    return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>Nested frame</p><img id="nestedimg" src="/img/nestedimg.png"></body></html>';
}

function infinitePage() {
    return `<!DOCTYPE html><html><body><div style="height:3000px">start</div>
<script>window.addEventListener("scroll", () => { if (innerHeight + scrollY > document.body.scrollHeight - 2000) { const d = document.createElement("div"); d.style.height = "20000px"; d.textContent = "more"; document.body.appendChild(d); } });</script></body></html>`;
}

// Reloads itself once, about a second after the saver starts (like news sites that refresh after a few minutes).
// The image takes 4 s and may not be cached, so saving it again takes as long as the first load.
function reloadingPage() {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<script>if (!sessionStorage.getItem("reloaded")) setTimeout(() => { sessionStorage.setItem("reloaded", "1"); location.reload(); }, 5000);</script>
</head><body><p id="reloadtext">Page that reloads itself</p><img id="slowimg" src="/img/slow-nostore.png"></body></html>`;
}

function html(res, body) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(body);
}

function listen(handler) {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => handler(req, res).catch(e => { res.writeHead(500); res.end(String(e)); }));
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

/**
 * Start the test site. Returns { base, crossBase, adBase, close() }.
 */
async function startFixture() {
    let base, crossBase, adBase;

    const handler = async (req, res) => {
        const p = new URL(req.url, 'http://x').pathname;

        if (p === '/') return html(res, mainPage(base, crossBase, adBase));
        if (p === '/frame') return html(res, framePage());
        if (p === '/nested') return html(res, nestedPage());
        if (p === '/infinite') return html(res, infinitePage());
        if (p === '/reloading') return html(res, reloadingPage());
        if (p === '/img/slow-nostore.png') {
            await sleep(4000);
            res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
            return res.end(PNG);
        }
        if (p === '/font/testfont.woff2') {
            res.writeHead(200, { 'Content-Type': 'font/woff2', 'Access-Control-Allow-Origin': '*' });
            return res.end(FONT);
        }
        if (p.startsWith('/img/')) {
            if (p === '/img/slow.png') await sleep(3000);
            if (p.startsWith('/img/many')) await sleep(600);
            // Like CDNs that reject CORS-mode fetches but allow plain <img> loads
            if (p === '/img/hotlink.png' && req.headers['sec-fetch-mode'] === 'cors') { res.writeHead(403); return res.end('forbidden'); }
            res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'max-age=3600' });
            return res.end(PNG);
        }
        res.writeHead(404);
        res.end('not found');
    };

    const main = await listen(handler);
    const cross = await listen(handler);

    base = `http://127.0.0.1:${main.address().port}`;
    crossBase = `http://127.0.0.1:${cross.address().port}`;
    adBase = `http://ads.localhost:${main.address().port}`;

    return {
        base, crossBase, adBase,
        close: () => Promise.all([main, cross].map(server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); })))
    };
}

module.exports = { startFixture };
