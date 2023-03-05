# nodeSavePageWE
This is an updated fork of the SavePageWE Chrome/Firefox extension by DW-dev. The 2019 version was based of then current version of the SavePageWE chrome extension and this version uses the March 2023 version. The old version still works but doesn't give good results on many websites anymore. The newer version should fix many of these errors.

It allows you to convert a website into a single, self-contained HTML that embeds most of the required resources. It uses puppeteer as a headless Chrome browser on the backend. 

Usage is very simple: this example converts the New York Times home page to a single HTML file.

```
var savePageWE=require('./nodeSavePageWE');


savePageWE.scrape({ url: "https://www.nytimes.com", path: "nytimes.html" }).then(function ()
{
    console.log("ok");
});

```

I found that SavePageWE is the best and fastest single-page HTML condenser. Unfortunately, headless Chrome does not allow Chrome extensions. The original codebase consists essentially of two scripts: (1) a background script that runs outside the website and interacts with the Save button, loads images and other resources etc.; and (2) a client script that traverses all frames and collects a list of images, scripts, fonts etc.

In this fork, I wrote a new background script for Node.js but kept most of the code from the client script (the ``NodeSavePage_client.js`` source file combines the ``content.js`` and ``content-frame.js`` file from the extension. Since I couldn't find the original project by DW-dev on GitHub I am also including the original Chrome extension code.

I am mostly using this code for scraping news websites and on a test sample this Node.js version seems to work about as well as the original extension (with some oddities such as sometimes not loading all images). Please contribute and make it better!
