import type { Browser, LaunchOptions } from 'puppeteer';

export type AdblockLevel = 'none' | 'annoyances' | 'simple' | 'extended';

export interface SavePageOptions {
    /** File to write the saved page to. */
    path?: string;
    /** Browser from `launch()` to reuse. It is not closed by `savePage()`. */
    browser?: Browser;

    /** Overall time limit in ms. Default 300000. */
    timeout?: number;
    /** Time limit for loading the page in ms. Default 180000. */
    navigationTimeout?: number;
    /** Puppeteer `waitUntil` for navigation. By default waits for DOMContentLoaded, then up to `loadTimeout` for the load event. */
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
    /** Maximum wait in ms for the load event after DOMContentLoaded. Default 30000. */
    loadTimeout?: number;
    /** Maximum wait in ms for web fonts. Default 10000. */
    fontTimeout?: number;
    /** Maximum wait in ms for images (including lazy images) to finish loading. Default 10000. */
    imageTimeout?: number;
    /** Maximum time in ms to capture each frame. Default 10000. */
    frameTimeout?: number;
    /** Extra wait in ms before saving. Default 0. */
    delay?: number;
    /** Browser viewport. Default 1600 x 10000. */
    viewport?: { width: number; height: number };
    /** User agent. Default: the browser's own, without "Headless". */
    userAgent?: string;

    /**
     * What to block with the Ghostery adblocker while the page loads. Default 'annoyances'.
     * - 'none': nothing - the page is saved exactly as displayed
     * - 'annoyances': cookie notices and pop-ups such as subscription prompts; ads are kept
     * - 'simple': ads and trackers
     * - 'extended': ads, trackers, annoyances and the StevenBlack hosts list
     */
    adblock?: AdblockLevel;

    /** Scroll through the page to trigger lazy-loaded content before saving. Default false. */
    loadLazyContent?: boolean;
    /** Same as `loadLazyContent` (older name). */
    lazyload?: boolean;
    /** 0 = scroll page, 1 = shrink page. Default 0. */
    lazyLoadType?: 0 | 1;
    /** Seconds between scroll steps. Default 0.2. */
    lazyLoadScrollTime?: number;
    /** Seconds to wait in shrink mode. Default 0.5. */
    lazyLoadShrinkTime?: number;
    /** Maximum seconds spent loading lazy content. Default 60. */
    lazyLoadMaxTime?: number;
    /** Force loading of images using `loading="lazy"` or lazy-load libraries. Default true. */
    loadLazyImages?: boolean;

    /** 0 = basic, 1 = standard, 2 = custom (see the `save*` options). Default 1. */
    savedItems?: 0 | 1 | 2;
    saveHTMLImagesAll?: boolean;
    saveHTMLAudioVideo?: boolean;
    saveHTMLObjectEmbed?: boolean;
    saveCSSImagesAll?: boolean;
    saveCSSFontsWoff?: boolean;
    saveCSSFontsAll?: boolean;
    saveScripts?: boolean;

    /** Maximum size of one resource in MB. Default 50. */
    maxResourceSize?: number;
    /** Maximum total size of all resources in MB. Default 250. */
    maxTotalSize?: number;
    /** Maximum seconds to load one resource. Default 10. */
    maxResourceTime?: number;
    /** Maximum number of resources loaded at the same time. Default 12. */
    maxConcurrentLoads?: number;
    /** Maximum depth of nested frames to save. Default 5. */
    maxFrameDepth?: number;

    /** Allow scripts in the saved page to run. If false, scripts and inline event handlers are kept but disabled. Default false. */
    executeScripts?: boolean;
    /** Append a comment with timings and a resource list to the saved page. Default false. */
    includeSummary?: boolean;
    /** Indent the saved HTML. Default false. */
    formatHTML?: boolean;
    /** Log progress to the page console. Default false. */
    debugEnable?: boolean;

    retainCrossFrames?: boolean;
    mergeCSSImages?: boolean;
    removeUnsavedURLs?: boolean;
    removeElements?: boolean;
    rehideElements?: boolean;
    allowPassive?: boolean;
    crossOrigin?: 0 | 1;
    swapDevices?: boolean;
}

export interface SavePageResult {
    /** The saved page. */
    html: string;
    /** Number of external resources found. */
    resources: number;
    /** Resources that could not be loaded, e.g. reason 'load:404', 'maxtime', 'maxsize', 'mixed'. */
    failed: Array<{ url: string; reason: string }>;
    /** Resources left out because they exceed `maxResourceSize`. */
    skipped: Array<{ url: string; size: string }>;
    /** Number of requests blocked by the ad blocker. */
    blockedRequests: number;
    /** Host names of blocked requests. */
    blockedHosts: string[];
}

/** Save a web page as a single self-contained HTML file. */
export function savePage(url: string, options?: SavePageOptions): Promise<SavePageResult>;
export function savePage(options: SavePageOptions & { url: string }): Promise<SavePageResult>;

/** Same as `savePage(options)` - kept for compatibility with earlier versions. */
export function scrape(task: SavePageOptions & { url: string }): Promise<SavePageResult>;

/** Launch a browser configured for saving pages, to reuse with the `browser` option. `args` are added to the required Chrome flags. */
export function launch(options?: LaunchOptions): Promise<Browser>;
