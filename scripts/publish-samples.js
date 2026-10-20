// Publishes samples/ (viewer and saved pages) to the gh-pages branch for GitHub Pages: npm run samples:publish
//
// The branch is replaced with a single new commit each time, so old samples don't pile up in the repository.
// Uses your own git login to push. Options: --remote <name> (default: origin), --dry-run (commit but don't push)

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseArgs } = require('util');
const { SAMPLES_DIR } = require('./samples-config');

const BRANCH = 'gh-pages';

const { values } = parseArgs({ options: { remote: { type: 'string' }, 'dry-run': { type: 'boolean' } } });
const remote = values.remote || 'origin';

function git(args, cwd) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
}

// git config exits with an error when the setting is not set
function gitConfig(name, fallback) {
    try {
        return git(['config', name], repo) || fallback;
    }
    catch (e) {
        return fallback;
    }
}

const repo = path.join(__dirname, '..');

if (!fs.existsSync(path.join(SAMPLES_DIR, 'manifest.json'))) {
    console.error('No samples found. Create them first with: npm run samples');
    process.exit(1);
}

const remoteUrl = git(['remote', 'get-url', remote], repo);
const source = git(['rev-parse', '--short', 'HEAD'], repo);

// Build the commit in a temporary repository so the working copy and its history are not touched
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'save-page-we-pages-'));
try {
    fs.cpSync(SAMPLES_DIR, temp, { recursive: true });

    git(['init', '--quiet', '--initial-branch', BRANCH], temp);
    git(['config', 'core.autocrlf', 'false'], temp);  // publish files byte for byte
    git(['add', '--all'], temp);
    git(['-c', 'user.name=' + gitConfig('user.name', 'save-page-we'), '-c', 'user.email=' + gitConfig('user.email', 'save-page-we@users.noreply.github.com'),
        'commit', '--quiet', '-m', `Samples from ${source}`], temp);

    const files = git(['ls-files'], temp).split('\n').length;
    const bytes = fs.readdirSync(temp, { recursive: true }).reduce((sum, f) => {
        const p = path.join(temp, f);
        return p.includes(`${path.sep}.git`) || !fs.statSync(p).isFile() ? sum : sum + fs.statSync(p).size;
    }, 0);
    console.log(`Prepared ${files} files (${(bytes / 1048576).toFixed(0)} MB) for ${remoteUrl} ${BRANCH}`);

    if (values['dry-run']) {
        console.log('Dry run - not pushed.');
    }
    else {
        execFileSync('git', ['push', '--force', remoteUrl, `${BRANCH}:${BRANCH}`], { cwd: temp, stdio: 'inherit' });

        const match = /github\.com[:/]([^/]+)\/(.+?)(\.git)?$/.exec(remoteUrl);
        console.log(match
            ? `Published. If GitHub Pages is set up to deploy from the ${BRANCH} branch, the samples are at https://${match[1]}.github.io/${match[2]}/`
            : 'Published.');
    }
}
finally {
    fs.rmSync(temp, { recursive: true, force: true });
}
