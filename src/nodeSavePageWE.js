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

        require('events').EventEmitter.defaultMaxListeners = 50;

        const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));


        //disable web security to allow CORS requests
        const browser = await puppeteer.launch({ headless: true, args: ["--disable-features=BlockInsecurePrivateNetworkRequests","--disable-features=IsolateOrigins", "--disable-site-isolation-trials", '--disable-web-security', "--proxy-server='direct://'", '--proxy-bypass-list=*'] });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36');

        await page.setViewport({
            width: 1600,
            height: 10000
        });

        await page.goto(task.url, { timeout: 180000, waitUntil: ['domcontentloaded'] });


        await page.addScriptTag({ path: "nodeSavePageWE_client.js" });


        await page.evaluate(async (params) => { 
            runSinglePage(params);
        }, {"lazyload":task.lazyload});

        
        var savedPageHTML="";
        while(true)
        {
            savedPageHTML = await page.evaluate(async () => { 
                return htmlFINAL;
            }, {});
            if (savedPageHTML!="NONE")
            {
                break;
            }
            /*var status = await page.evaluate(async () => { 
                return htmlSTATUS;
            }, {});
            console.log(status);*/
            await snooze(100);
        }
        
        //now inject resources back into page
        fs.writeFileSync(task.path, savedPageHTML);
        await browser.close();
    }
};

