// Save a page as a single HTML file. Run from the repository root: npm run example
// In your own project, use: const { savePage } = require('save-page-we');
const { savePage } = require('..');

savePage('https://www.nytimes.com', {
    // File to write the saved page to (leave out to only get the HTML in result.html)
    path: 'nytimes.html',

    // What to block while the page loads:
    //   'none'        nothing - the page is saved exactly as displayed, including cookie notices and pop-ups
    //   'annoyances'  cookie notices and pop-ups such as subscription prompts; ads are kept (default)
    //   'simple'      ads and trackers
    //   'extended'    ads, trackers, annoyances and the StevenBlack hosts list
    adblock: 'annoyances',

    // Scroll through the page first, so images and sections that only load when scrolled into view are saved.
    // Slower, but saves more of long pages. Default false.
    loadLazyContent: false,

    // Overall time limit in ms. Default 300000 (5 minutes).
    timeout: 300000

    // More options (resource limits, frames, user agent, ...) are listed in the README.
})
    .then(result => {
        console.log(`saved nytimes.html - ${result.resources} resources, ${result.failed.length} failed, ${result.skipped.length} skipped, ${result.blockedRequests} blocked`);
        for (const failure of result.failed) console.log(`  failed: ${failure.reason} ${failure.url}`);
    })
    .catch(error => {
        console.error('save failed: ' + error.message);
        process.exitCode = 1;
    });
