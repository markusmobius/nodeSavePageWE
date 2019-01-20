/************************************************************************/
/*                                                                      */
/*      Based on: Save Page WE - Generic WebExtension - Background Page */
/*                (forked on December 31, 2018)                         */
/*      Copyright (C) 2016-2018 DW-dev                                  */
/*                                                                      */
/*      Adapted for Node/Puppeteer by Markus Mobius                     */
/*      markusmobius@gmail.com                                          */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*      See LICENCE.txt file and http://www.gnu.org/licenses/           */
/*                                                                      */
/************************************************************************/

module.exports = {
    scrape: async function (task) {

        const fs = require('fs');
        const puppeteer = require('puppeteer');

        //read pageloader 
        var pageLoaderCompressed = fs.readFileSync('pageloader-compressed.js', 'utf8');

        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();

        var resources = {};
        page.on('response', async (response) => {
            var headers = response.headers();
            try {
                var byteArray = await response.buffer();
                binaryString = "";
                for (i = 0; i < byteArray.byteLength; i++) binaryString += String.fromCharCode(byteArray[i]);
                resources[response.url()] = {
                    content: binaryString,
                    contentType: headers["content-type"]
                };
            }
            catch{ }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36');

        await page.setViewport({
            width: 1600,
            height: 1000
        });

        await page.goto(task.url, { timeout: 90000 });
        await page.addScriptTag({ path: "nodeSavePageWE_client.js" });

        var savedPageHTML = await page.evaluate(async (params) => {
            pageLoaderText = params.pageLoaderCompressed;
            resourcesList = params.resources;
            await identifyCrossFrames();
            return htmlOutput;
        }, { "pageLoaderCompressed": pageLoaderCompressed, "resources": resources });
        fs.writeFileSync(task.path, savedPageHTML);
        await browser.close();
    }
};

