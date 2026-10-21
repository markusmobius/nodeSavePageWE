# Development

This file is for people working on save-page-we itself. For using the package, see [README.md](README.md).

## Running the tests

```
git clone https://github.com/markusmobius/nodeSavePageWE.git
cd nodeSavePageWE
npm install
npm test
```

The tests save a local test site (in `test/fixture`) with cross-origin and nested frames, CSS-in-JS, web fonts, lazy images and ads, and check the saved page offline.

## Example pages

Example pages saved from news sites (CBS News, The Guardian, Politico and USA Today) show what the saver produces. Each publisher is saved in six variants: without and with lazy loading (`loadLazyContent`), each with the blocking levels `annoyances`, `simple` and `extended`.

```
npm run samples           # save all 24 pages from the live sites (takes 20-40 minutes)
npm run samples:view      # look at them in the sample viewer
npm run samples:publish   # publish them to GitHub Pages
```

`npm run samples` saves one page at a time, each in a new browser so that no page sees cookies from an earlier one (news sites show more banners and anti-adblock walls to returning visitors). It writes the pages gzip-compressed to `samples/<loading>/<level>/<publisher>.html.gz` and records them in `samples/manifest.json`. You can save only some of them, for example `npm run samples -- guardian lazy extended`.

The viewer (`samples/index.html`, from `scripts/samples-viewer.html`) lets you choose the publisher, lazy loading and blocking level, or compare the three blocking levels side by side. It unpacks the pages in the browser. Browsers don't let a page opened from disk read other files, so `npm run samples:view` serves the folder locally and opens the viewer.

The pages are large (about 220 MB compressed together), so `samples/` is not committed. Instead, `npm run samples:publish` pushes it to the `gh-pages` branch, replacing the branch with a single new commit each time, so old samples don't build up in the repository. It uses your own git login. To make the samples viewable online, enable GitHub Pages once: on GitHub, open the repository's **Settings > Pages**, choose **Deploy from a branch**, and select the `gh-pages` branch and the `/ (root)` folder. The viewer is then at https://markusmobius.github.io/nodeSavePageWE/.

## Publishing

Releases go through npm's [staged publishing](https://docs.npmjs.com/staged-publishing): GitHub Actions (`.github/workflows/release.yml`) uploads the new version to a staging area, and a maintainer approves it with two-factor authentication (2FA) before anyone can install it.

### One-time setup

Enable 2FA on your npm account, then choose one way for the workflow to sign in:

* **Stage-only token:** on npmjs.com, create a granular access token with the permission **Read and write (stage only)** and add it to the GitHub repository as the secret `NPM_TOKEN` (Settings > Secrets and variables > Actions). Before the first release the package doesn't exist yet, so give the token access to all packages; afterwards you can limit it to `save-page-we`.
* **Trusted publishing (recommended by npm, no secret to manage):** once the package exists, open its settings on npmjs.com, add a trusted publisher for GitHub Actions with this repository and the workflow `release.yml`, and allow it to stage only. Then remove the `NPM_TOKEN` secret.

### Releasing a version

1. Update `version` in `package.json` and add the changes under a `## <version>` heading in `CHANGELOG.md`. Commit and push.
2. Tag the commit and push the tag:
   ```
   git tag v1.0.1
   git push origin v1.0.1
   ```
   The workflow checks that the tag matches `package.json`, runs the tests, stages the package on npm and creates the GitHub release, using the version's `CHANGELOG.md` section as release notes.
3. Approve the staged version: on npmjs.com, open the **Staged Packages** tab and click **Approve**, or run `npm stage list save-page-we` and `npm stage approve <stage-id>` (needs npm 11.15.0 or later). Approving asks for your 2FA code.

When the very first version is staged, npm creates the package with a placeholder version `0.0.0-stage`. The real version appears once you approve it.

To release by hand instead, run `npm stage publish` in the repository and approve as above, or `npm publish` (asks for your 2FA code).

Only `lib/`, `bin/`, `index.d.ts`, `README.md`, `CHANGELOG.md` and `LICENSE` are included in the npm package (see `files` in `package.json`). Check the contents with `npm pack --dry-run` before publishing.
