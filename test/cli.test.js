const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const { startFixture } = require('./fixture/server');
const { version } = require('../package.json');

const BIN = path.join(__dirname, '..', 'bin', 'savepagewe.js');

let site;
before(async () => { site = await startFixture(); });
after(async () => { await site?.close(); });

function run(...args) {
    return new Promise(resolve => {
        execFile(process.execPath, [BIN, ...args], { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
            resolve({ code: error ? error.code : 0, stdout, stderr });
        });
    });
}

test('prints help and version', async () => {
    const help = await run('--help');
    assert.equal(help.code, 0);
    assert.match(help.stdout, /Usage: savepagewe <url>/);

    const ver = await run('-v');
    assert.equal(ver.code, 0);
    assert.equal(ver.stdout.trim(), version);
});

test('rejects invalid arguments with exit code 2', async () => {
    assert.equal((await run()).code, 2);
    assert.equal((await run('a', 'b')).code, 2);
    assert.equal((await run(site.base, '--adblock', 'yes')).code, 2);
    assert.equal((await run(site.base, '--viewport', 'big')).code, 2);
    assert.equal((await run(site.base, '--unknown')).code, 2);
});

test('saves to a file and prints a JSON report', async () => {
    const file = path.join(os.tmpdir(), `save-page-we-cli-${process.pid}.html`);
    try {
        const { code, stdout, stderr } = await run(site.base + '/', '-o', file, '--json');

        assert.equal(code, 0, stderr);
        const report = JSON.parse(stdout);
        assert.equal(report.output, file);
        assert.ok(report.resources > 40);
        assert.deepEqual(report.failed, [{ url: site.base + '/missing.css', reason: 'load:404' }]);
        assert.match(fs.readFileSync(file, 'utf8'), /CSS-in-JS \+ web font text/);
    }
    finally {
        fs.rmSync(file, { force: true });
    }
});

test('writes HTML to stdout and the report to stderr without --output', async () => {
    const { code, stdout, stderr } = await run(site.base + '/nested');

    assert.equal(code, 0, stderr);
    assert.match(stdout, /<img id="nestedimg"[^>]* src="data:image\/png;base64,/);
    assert.match(stderr, /^saved .* resources, 0 failed/);
});

test('exits with code 1 when the save fails', async () => {
    const { code, stderr } = await run('http://127.0.0.1:1/', '--timeout', '20000');

    assert.equal(code, 1);
    assert.match(stderr, /savepagewe: /);
});
