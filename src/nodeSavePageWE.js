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
        var request = require('request');
        require('events').EventEmitter.defaultMaxListeners = 50;

        const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));

        //read pageloader 
        var pageLoaderCompressed = fs.readFileSync('pageloader-compressed.js', 'utf8');

        //disable web security to allow CORS requests
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-web-security'] });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36');

        await page.setViewport({
            width: 1600,
            height: 10000
        });
        // Original Code
        // await page.goto(task.url, { timeout: 300000 });
        // if URL cannot visit, here will close the puppeteer   
        // start
        try {
            await page.goto(task.url, { timeout: 300000 });
        } catch (e) {
            browser.close()
            return Promise.reject(false)
        }
        // end
        await page.addScriptTag({ path: "nodeSavePageWE_client.js" });

        //load website and gather all the resources
        var toPuppeteer = await page.evaluate(async (params) => {
            pageLoaderText = params.pageLoaderCompressed;
            return await identifyCrossFrames();
        }, { "pageLoaderCompressed": pageLoaderCompressed });
        //fs.writeFileSync("1.txt", JSON.stringify(toPuppeteer));

        //now collect all the resources
        var responses = {};
		var resources={};
        var completed_requests = 0;
        var good_requests = 0;
        var bad_requests = 0;
        for (i in toPuppeteer) {
            const options = {
                url: toPuppeteer[i].url,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36',
                    'Referer': toPuppeteer[i].referer
                },
                encoding: null,
                gzip: true
            };          
            request(options, function callback(error, response, body) {
                if (!error && response.statusCode == 200){
                    binaryString = "";
                    for (var j = 0; j < body.byteLength; j++) binaryString += String.fromCharCode(body[j]);
                    responses[this.i] = {
                        "success": true,
                        "content": binaryString,
                        "mime": response.headers['content-type']
                    };
					resources[toPuppeteer[this.i].url]={
						content: binaryString,
						contentType: response.headers["content-type"]
					}
                    good_requests++;
                }
                else {
                    responses[this.i] = {
                        "success": false
                    };
                    bad_requests++;
                }
                completed_requests++;
            }.bind({i:i}));
            while (i - completed_requests > 50) {
                await snooze(10);
            }
        }
        while(completed_requests<toPuppeteer.length)
        {
            await snooze(100);
        }

        //now inject resources back into page
        var savedPageHTML = await page.evaluate(async (params) => { 
            await loadPageLoader(params.scrapedResources);
            return htmlOutput;
        }, { "scrapedResources": responses });
        fs.writeFileSync(task.path, savedPageHTML);
        await browser.close();
    }
};

