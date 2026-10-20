// Publishers and variants for the example pages in samples/ (see DEVELOPMENT.md)

const path = require('path');

const SAMPLES_DIR = path.join(__dirname, '..', 'samples');
const VIEWER = path.join(__dirname, 'samples-viewer.html');

const PUBLISHERS = {
    cbsnews: { name: 'CBS News', url: 'https://www.cbsnews.com' },
    guardian: { name: 'The Guardian', url: 'https://www.theguardian.com/international' },
    politico: { name: 'Politico', url: 'https://www.politico.com' },
    usatoday: { name: 'USA Today', url: 'https://www.usatoday.com' }
};

// {non-lazy, lazy} x {annoyances, simple, extended}
const LOADING = {
    nonlazy: { name: 'Not lazy', options: {} },
    lazy: { name: 'Lazy loading', options: { loadLazyContent: true } }
};

const LEVELS = {
    annoyances: { name: 'Annoyances blocked, ads kept', options: { adblock: 'annoyances' } },
    simple: { name: 'Ads and trackers blocked', options: { adblock: 'simple' } },
    extended: { name: 'Everything blocked', options: { adblock: 'extended' } }
};

function sampleFile(loading, level, publisher) {
    return `${loading}/${level}/${publisher}.html.gz`;
}

module.exports = { SAMPLES_DIR, VIEWER, PUBLISHERS, LOADING, LEVELS, sampleFile };
