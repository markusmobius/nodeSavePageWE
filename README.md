# nodeSavePageWE
Fork of SavePageWE Chrome Extension adapted for Node.js plus Puppeteer: converts a website into a self-contained single html file

This is a fork of the SavePageWE Chrome/Firefox extension by DW-dev. 

It allows you to convert a website into a single, self-contained HTML that embeds most of the required resources. It uses puppeteer as a headless Chrome browser on the backend. 

```
hello
```

I found that SavePageWE is the best and fastest single-page HTML condenser. Unfortunately, headless Chrome does not allow Chrome extensions. The original codebase consists essentially of two scripts: (1) a background script that runs outside the website and interacts with the Save button, loads images and other resources etc.; and (2) a client script that traverses all frames and collects a list of images, scripts, fonts etc.


