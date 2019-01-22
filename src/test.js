var savePageWE=require('./nodeSavePageWE');


savePageWE.scrape({ url: "https://www.bbc.com", path: "bbc.html" }).then(function ()
{
    console.log("ok");
});
