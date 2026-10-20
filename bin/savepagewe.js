#!/usr/bin/env node
/************************************************************************/
/*                                                                      */
/*      savepagewe - command line interface of save-page-we             */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*                                                                      */
/************************************************************************/

'use strict';

const { parseArgs } = require('util');
const { savePage } = require('../lib/index.js');
const { version } = require('../package.json');

const USAGE = `Usage: savepagewe <url> [options]

Save a web page as a single self-contained HTML file.

Options:
  -o, --output <file>          Write the saved page to <file> (default: write HTML to stdout)
  -a, --adblock <level>        none, annoyances (default), simple or extended
  -l, --lazy-load              Scroll through the page to load lazy content first
      --timeout <ms>           Overall time limit (default 300000)
      --delay <ms>             Extra wait before saving (default 0)
      --max-resource-size <mb> Maximum size of one resource (default 50)
      --max-resource-time <s>  Maximum time to load one resource (default 10)
      --user-agent <string>    User agent (default: the browser's own, without "Headless")
      --viewport <WxH>         Browser viewport (default 1600x10000)
      --format-html            Indent the saved HTML
      --include-summary        Add a comment with timings and resources to the saved page
      --json                   Print the report as JSON
  -q, --quiet                  Don't print the report
  -v, --version                Print the version
  -h, --help                   Print this help

The report (resources, failed, skipped and blocked) goes to stdout when --output is given, otherwise to stderr.
Exit code: 0 saved, 1 save failed, 2 invalid arguments.`;

function fail(message, code) {
    process.stderr.write(`savepagewe: ${message}\n`);
    process.exit(code);
}

function number(name, value) {
    if (value === undefined) return undefined;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) fail(`--${name} must be a non-negative number`, 2);
    return n;
}

function parse() {
    let parsed;
    try {
        parsed = parseArgs({
            allowPositionals: true,
            options: {
                output: { type: 'string', short: 'o' },
                adblock: { type: 'string', short: 'a' },
                'lazy-load': { type: 'boolean', short: 'l' },
                timeout: { type: 'string' },
                delay: { type: 'string' },
                'max-resource-size': { type: 'string' },
                'max-resource-time': { type: 'string' },
                'user-agent': { type: 'string' },
                viewport: { type: 'string' },
                'format-html': { type: 'boolean' },
                'include-summary': { type: 'boolean' },
                json: { type: 'boolean' },
                quiet: { type: 'boolean', short: 'q' },
                version: { type: 'boolean', short: 'v' },
                help: { type: 'boolean', short: 'h' }
            }
        });
    }
    catch (e) {
        fail(`${e.message}\n\n${USAGE}`, 2);
    }

    const { values, positionals } = parsed;

    if (values.help) { process.stdout.write(USAGE + '\n'); process.exit(0); }
    if (values.version) { process.stdout.write(version + '\n'); process.exit(0); }
    if (positionals.length !== 1) fail(`expected exactly one URL\n\n${USAGE}`, 2);

    let viewport;
    if (values.viewport !== undefined) {
        const match = /^(\d+)x(\d+)$/i.exec(values.viewport);
        if (!match) fail('--viewport must look like 1600x10000', 2);
        viewport = { width: +match[1], height: +match[2] };
    }

    const adblock = values.adblock ?? 'annoyances';
    if (!['none', 'annoyances', 'simple', 'extended'].includes(adblock)) fail('--adblock must be none, annoyances, simple or extended', 2);

    return {
        url: positionals[0],
        output: values.output,
        json: values.json,
        quiet: values.quiet,
        options: {
            adblock,
            loadLazyContent: values['lazy-load'] || undefined,
            timeout: number('timeout', values.timeout),
            delay: number('delay', values.delay),
            maxResourceSize: number('max-resource-size', values['max-resource-size']),
            maxResourceTime: number('max-resource-time', values['max-resource-time']),
            userAgent: values['user-agent'],
            viewport,
            formatHTML: values['format-html'] || undefined,
            includeSummary: values['include-summary'] || undefined
        }
    };
}

function formatReport(url, output, report) {
    const lines = [`saved ${url}${output ? ' to ' + output : ''}: ${report.resources} resources, ${report.failed.length} failed, ${report.skipped.length} skipped, ${report.blockedRequests} requests blocked`];
    for (const failure of report.failed) lines.push(`  failed  ${failure.reason}  ${failure.url}`);
    for (const skip of report.skipped) lines.push(`  skipped ${skip.size}  ${skip.url}`);
    return lines.join('\n') + '\n';
}

async function main() {
    const { url, output, json, quiet, options } = parse();

    let result;
    try {
        result = await savePage(url, { ...options, path: output });
    }
    catch (e) {
        fail(e.message, 1);
    }

    const { html, ...report } = result;

    if (!output) process.stdout.write(html);

    if (!quiet) {
        const text = json ? JSON.stringify({ url, output: output || null, ...report }, null, 2) + '\n' : formatReport(url, output, report);
        (output ? process.stdout : process.stderr).write(text);
    }
}

main();
