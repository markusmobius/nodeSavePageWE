var savePageWE=require('./nodeSavePageWE');


savePageWE.scrape({ url: "https://www.cnn.com", path: "cnn.html" }).then(function ()
{
    console.log("ok");
});
