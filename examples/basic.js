// Save a page as a single HTML file. Run from the repository root: npm run example
// In your own project, use: const { savePage } = require('save-page-we');
const { savePage } = require('..');

savePage('https://www.nytimes.com', { path: 'nytimes.html' })
    .then(result => {
        console.log(`saved nytimes.html - ${result.resources} resources, ${result.failed.length} failed, ${result.skipped.length} skipped`);
        for (const failure of result.failed) console.log(`  failed: ${failure.reason} ${failure.url}`);
    })
    .catch(error => {
        console.error('save failed: ' + error.message);
        process.exitCode = 1;
    });