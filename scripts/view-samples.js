// Serves samples/ and opens the sample viewer: npm run samples:view
// Browsers don't let a page opened from disk (file://) read other files, so the viewer needs a server.
// Options: --port <n> (default: any free port), --no-open (don't open the browser)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { parseArgs } = require('util');
const { SAMPLES_DIR } = require('./samples-config');

const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.gz': 'application/gzip' };

const { values } = parseArgs({ options: { port: { type: 'string' }, 'no-open': { type: 'boolean' } } });

if (!fs.existsSync(path.join(SAMPLES_DIR, 'manifest.json'))) {
    console.error('No samples found. Create them first with: npm run samples');
    process.exit(1);
}

const server = http.createServer((req, res) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    }
    catch (e) {
        res.writeHead(400);
        return res.end();
    }
    if (pathname.endsWith('/')) pathname += 'index.html';

    const file = path.join(SAMPLES_DIR, pathname);
    if (!file.startsWith(SAMPLES_DIR + path.sep)) {
        res.writeHead(403);
        return res.end();
    }

    fs.stat(file, (error, stat) => {
        if (error || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Not found');
        }
        // Served as they are, like GitHub Pages - the viewer unpacks .gz files itself
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-cache' });
        fs.createReadStream(file).pipe(res);
    });
});

server.listen(Number(values.port) || 0, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${server.address().port}/`;
    console.log(`Sample viewer: ${url}  (Ctrl+C to stop)`);

    if (!values['no-open']) {
        const [command, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
            : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
        spawn(command, args, { stdio: 'ignore', detached: true }).on('error', () => { }).unref();
    }
});
