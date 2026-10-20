// Re-creates the example pages in samples/ from the live sites: npm run samples
//
// Saves every publisher in every variant - {non-lazy, lazy} x {annoyances, simple, extended} - as
// samples/<loading>/<level>/<publisher>.html.gz, records them in samples/manifest.json and copies the viewer
// to samples/index.html. View them with: npm run samples:view
//
// Optional arguments limit what is saved, e.g. npm run samples -- guardian politico lazy extended

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { savePage, launch } = require('..');
const { version } = require('../package.json');
const { SAMPLES_DIR, VIEWER, PUBLISHERS, LOADING, LEVELS, sampleFile } = require('./samples-config');

const gzip = promisify(zlib.gzip);

const TIMEOUT = 10 * 60 * 1000;  // per page - ad-heavy pages without ad blocking can take several minutes

function selection(args) {
    const pick = (all) => {
        const chosen = args.filter(arg => all.includes(arg));
        return chosen.length ? chosen : all;
    };
    const known = [...Object.keys(PUBLISHERS), ...Object.keys(LOADING), ...Object.keys(LEVELS)];
    const unknown = args.filter(arg => !known.includes(arg));
    if (unknown.length) throw new Error(`Unknown argument: ${unknown.join(', ')} (known: ${known.join(', ')})`);

    return { publishers: pick(Object.keys(PUBLISHERS)), loadings: pick(Object.keys(LOADING)), levels: pick(Object.keys(LEVELS)) };
}

function readManifest() {
    try {
        return JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, 'manifest.json'), 'utf8'));
    }
    catch (e) {
        return { samples: {} };
    }
}

function writeManifest(manifest) {
    manifest.updated = new Date().toISOString();
    manifest.version = version;
    manifest.publishers = Object.fromEntries(Object.entries(PUBLISHERS).map(([id, p]) => [id, { name: p.name, url: p.url }]));
    manifest.loadings = Object.fromEntries(Object.entries(LOADING).map(([id, l]) => [id, { name: l.name }]));
    manifest.levels = Object.fromEntries(Object.entries(LEVELS).map(([id, l]) => [id, { name: l.name }]));
    fs.writeFileSync(path.join(SAMPLES_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

async function main() {
    const { publishers, loadings, levels } = selection(process.argv.slice(2));

    const jobs = [];
    for (const publisher of publishers) for (const loading of loadings) for (const level of levels) jobs.push({ publisher, loading, level });

    fs.mkdirSync(SAMPLES_DIR, { recursive: true });
    fs.copyFileSync(VIEWER, path.join(SAMPLES_DIR, 'index.html'));
    fs.writeFileSync(path.join(SAMPLES_DIR, '.nojekyll'), '');  // GitHub Pages: serve files as they are

    const manifest = readManifest();
    console.log(`Saving ${jobs.length} samples`);

    // One page at a time, each in a new browser: saving in parallel made image downloads time out, and a shared
    // browser keeps cookies, so later saves looked like a returning visitor (support banners, anti-adblock walls)
    let failures = 0;
    for (const { publisher, loading, level } of jobs) {
        const file = sampleFile(loading, level, publisher);
        const start = Date.now();
        const browser = await launch();
        try {
            const result = await savePage(PUBLISHERS[publisher].url, {
                browser, timeout: TIMEOUT, ...LOADING[loading].options, ...LEVELS[level].options
            });

            const html = Buffer.from(result.html, 'utf8');
            const compressed = await gzip(html, { level: 9 });
            fs.mkdirSync(path.dirname(path.join(SAMPLES_DIR, file)), { recursive: true });
            fs.writeFileSync(path.join(SAMPLES_DIR, file), compressed);

            manifest.samples[file] = {
                publisher, loading, level, url: PUBLISHERS[publisher].url, saved: new Date().toISOString(),
                bytes: html.length, compressedBytes: compressed.length,
                resources: result.resources, failed: result.failed.length, skipped: result.skipped.length, blockedRequests: result.blockedRequests
            };
            writeManifest(manifest);

            console.log(`${file}: ${(html.length / 1048576).toFixed(1)} MB (${(compressed.length / 1048576).toFixed(1)} MB compressed), ${result.resources} resources, ${result.blockedRequests} blocked, ${Math.round((Date.now() - start) / 1000)} s`);
        }
        catch (e) {
            failures++;
            console.error(`${file}: failed - ${e.message}`);
        }
        finally {
            await browser.close();
        }
    }

    const total = Object.values(manifest.samples).reduce((sum, s) => sum + s.compressedBytes, 0);
    console.log(`Done - ${Object.keys(manifest.samples).length} samples, ${(total / 1048576).toFixed(0)} MB compressed. View them with: npm run samples:view`);
    if (failures) process.exitCode = 1;
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
