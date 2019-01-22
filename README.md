# nodeSavePageWE
This is a fork of the SavePageWE Chrome/Firefox extension by DW-dev. 

It allows you to convert a website into a single, self-contained HTML that embeds most of the required resources. It uses puppeteer as a headless Chrome browser on the backend. 

Usage is very simple: this example converts the CNN home page to a single HTML file.

```
var savePageWE=require('./nodeSavePageWE');


savePageWE.scrape({ url: "https://www.cnn.com", path: "cnn.html" }).then(function ()
{
    console.log("ok");
});

```

I found that SavePageWE is the best and fastest single-page HTML condenser. Unfortunately, headless Chrome does not allow Chrome extensions. The original codebase consists essentially of two scripts: (1) a background script that runs outside the website and interacts with the Save button, loads images and other resources etc.; and (2) a client script that traverses all frames and collects a list of images, scripts, fonts etc.

In this fork, I wrote a new background script for Node.js but kept most of the code from the client script. Since I couldn't find the original project by DW-dev on GitHub I am also including the original Chrome extension code.

I am mostly using this code for scraping news websites and on a test sample this Node.js version seems to work as well as the original extension - it also makes the same mistakes (currently the NYT page is not perfect). Please contribute and make it better!
