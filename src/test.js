var savePageWE=require('./nodeSavePageWE');


savePageWE.scrape({ url: "https://www.nytimes.com", path: "nytimes.html", lazyload: false }).then(function ()
{
    console.log("ok");
});
