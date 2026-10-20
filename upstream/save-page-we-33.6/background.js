/************************************************************************/
/*                                                                      */
/*      Save Page WE - Generic WebExtension - Background Worker         */
/*                                                                      */
/*      Javascript for Background Worker                                */
/*                                                                      */
/*      Last Edit - 28 Dec 2022                                         */
/*                                                                      */
/*      Copyright (C) 2016-2022 DW-dev                                  */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*      See LICENCE.txt file and http://www.gnu.org/licenses/           */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Refer to Google Chrome developer documentation:                      */
/*                                                                      */
/* developer.chrome.com/docs/extensions/mv3/overview                    */
/* developer.chrome.com/docs/extensions/mv3/content_scripts             */
/* developer.chrome.com/docs/extensions/mv3/messaging                   */
/* developer.chrome.com/docs/extensions/mv3/options                     */
/*                                                                      */
/* developer.chrome.com/docs/extensions/mv3/manifest                    */
/* developer.chrome.com/docs/extensions/mv3/declare_permissions         */
/* developer.chrome.com/docs/extensions/mv3/match_patterns              */
/*                                                                      */
/* developer.chrome.com/docs/extensions/reference/action                */
/* developer.chrome.com/docs/extensions/reference/commands              */
/* developer.chrome.com/docs/extensions/reference/contextMenus          */
/* developer.chrome.com/docs/extensions/reference/management            */
/* developer.chrome.com/docs/extensions/reference/notifications         */
/* developer.chrome.com/docs/extensions/reference/runtime               */
/* developer.chrome.com/docs/extensions/reference/storage               */
/* developer.chrome.com/docs/extensions/reference/tabs                  */
/* developer.chrome.com/docs/extensions/reference/webNavigation         */
/* developer.chrome.com/docs/extensions/reference/windows               */
/*                                                                      */
/* Refer to IETF data uri and mime type documentation:                  */
/*                                                                      */
/* RFC 2397 - https://tools.ietf.org/html/rfc2397                       */
/* RFC 2045 - https://tools.ietf.org/html/rfc2045                       */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Manifest Version 3 - Background Service Worker                       */
/*                                                                      */
/* This background script is a service worker which will be terminated  */
/* by Firefox or Chrome if it remains idle for more than 30 seconds.    */
/*                                                                      */
/* Delays with setTimeout or setInterval must be less than 30 seconds.  */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Manifest Version 3 - Management of Settings                          */
/*                                                                      */
/* 1. The value of the extension's global badge background color is     */
/*    used to determine whether the service worker is executing for     */
/*    the first time or has been reloaded.                              */
/*                                                                      */
/* 2. At the start of each event listener, the 'local' object is        */
/*    loaded with all of the properties currently in local storage.     */
/*                                                                      */
/* 3. When a property in the 'local' object is changed, the             */
/*    similarly named property is updated in local storage.             */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Manifest Version 3 - Saving Generated HTML Strings into a File       */
/*                                                                      */
/* 1. Cannot use chrome.downdloads.download() in background script      */
/*    because data url does not work and blob url cannot be created.    */
/*                                                                      */
/* 2. Instead the content script injects an iframe into the page DOM.   */
/*    The iframe loads an extension-origin page which in turn loads     */
/*    an extension-origin script.                                       */
/*                                                                      */
/* 3. The script has access to the same WebExtensions APIs as the       */
/*    background script and also has access to all of the Web API's.    */
/*                                                                      */
/* 4. The HMTML strings are transferred to the injected iframe and      */
/*    are then saved into a file using chrome.downdloads.download().    */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Notes on Save Page WE Operation                                      */
/*                                                                      */
/* 1. The basic approach is to identify all frames in the page and      */
/*    then traverse the DOM tree in three passes.                       */
/*                                                                      */
/* 2. The current states of the HTML elements are extracted from        */
/*    the DOM tree. External resources are downloaded and scanned.      */
/*                                                                      */
/* 3. A content script in each frame finds and sets keys on all         */
/*    sub-frame elements that are reachable from that frame.            */
/*                                                                      */
/* 4. The first pass gathers external style sheet resources:            */
/*                                                                      */
/*    - <style> element: find style sheet url()'s in @import rules,     */
/*      then remember locations.                                        */
/*                                                                      */
/*    - <link rel="stylesheet" href="..."> element: find style sheet    */
/*      url()'s in @import rules, then remember locations.              */
/*                                                                      */
/* 5. After the first pass, the referenced external style sheets are    */
/*    downloaded from the remembered locations.                         */
/*                                                                      */
/* 6. The second pass gathers external script/font/image resources:     */
/*                                                                      */
/*    - <script> element: remember location from src attribute.         */
/*                                                                      */
/*    - <link rel="icon" href="..."> element: remember location         */
/*      from href attribute.                                            */
/*                                                                      */
/*    - <img> element: remember location from src attribute.            */
/*                                                                      */
/*    if just saving currently displayed CSS images:                    */
/*                                                                      */
/*    - all elements: find url()'s in CSS computed style for element    */
/*      and for before/after pseudo-elements and remember locations.    */
/*                                                                      */
/*    otherwise, if saving all CSS images:                              */
/*                                                                      */
/*    - style attribute on any element: find image url()'s in CSS       */
/*      rules and remember locations.                                   */
/*                                                                      */
/*    - <style> element: handle @import rules, then find font and       */
/*      image url()'s in CSS rules and remember locations.              */
/*                                                                      */
/*    - <link rel="stylesheet" href="..."> element: handle @import      */
/*      rules, then find font and image url()'s in CSS rules and        */
/*      remember locations.                                             */
/*                                                                      */
/* 7. After the second pass, the referenced external resources are      */
/*     downloaded from the remembered locations.                        */
/*                                                                      */
/* 8. The third pass generates HTML and data uri's:                     */
/*                                                                      */
/*    - style attribute on any element: replace image url()'s in        */
/*       CSS rules with data uri's.                                     */
/*                                                                      */
/*    - <script> element: Javascript is not changed.                    */
/*                                                                      */
/*    - <script src="..."> element: convert Javascript to data uri      */
/*       and use this to replace url in src attribute.                  */
/*                                                                      */
/*    - <style> element: handle @import rules, then replace font and    */
/*       image url()'s in CSS rules with data uri's.                    */
/*                                                                      */
/*    - <link rel="stylesheet" href="..."> element: handle @import      */
/*       rules, then replace font and image url()'s in CSS rules        */
/*       with data uri's, then enclose in new <style> element and       */
/*       replace original <link> element.                               */
/*                                                                      */
/*    - <link rel="icon" href="..."> element: convert icon to data      */
/*       uri and use this to replace url in href attribute.             */
/*                                                                      */
/*    - <base href="..." target="..."> element: remove existing         */
/*       base element (if any) and insert new base element with href    */
/*       attribute set to document.baseURI and target attribute set     */
/*       to the same value as for removed base element (if any).        */
/*                                                                      */
/*    - <body background="..."> element: convert image to data uri      */
/*       and use this to replace url in background attribute.           */
/*                                                                      */
/*    - <img src="..."> element: convert current source image to        */
/*       data uri and use this to replace url in src attribute.         */
/*                                                                      */
/*    - <img srcset="..."> element: replace list of images in srcset    */
/*       attribute by empty string.                                     */
/*                                                                      */
/*    - <input type="image" src="..."> element: convert image to        */
/*       data uri and use this to replace url in src attribute.         */
/*                                                                      */
/*    - <input type="file"> or <input type="password"> element:         */
/*       no changes made to maintain security.                          */
/*                                                                      */
/*    - <input type="checkbox"> or <input type="radio"> element:        */
/*       add or remove checked attribute depending on the value of      */
/*       element.checked reflecting any user changes.                   */
/*                                                                      */
/*    - <input type="-other-"> element: add value attribute set to      */
/*       element.value reflecting any user changes.                     */
/*                                                                      */
/*    - <canvas> element: convert graphics to data uri and use this     */
/*       to define background image in style attribute.                 */
/*                                                                      */
/*    - <audio src="..."> element: if current source, convert audio     */
/*       to data uri and use this to replace url in src attribute.      */
/*                                                                      */
/*    - <video src="..."> element: if current source, convert video     */
/*       to data uri and use this to replace url in src attribute.      */
/*                                                                      */
/*    - <video poster="..."> element: convert image to data uri and     */
/*       use this to replace url in poster attribute.                   */
/*                                                                      */
/*    - <source src="..."> element in <audio> or <video> element:       */
/*       if current source, convert audio or video to data uri and      */
/*       use this to replace url in src attribute.                      */
/*                                                                      */
/*    - <source srcset="..."> element in <picture> element: replace     */
/*       list of images in srcset attribute by empty string.            */
/*                                                                      */
/*    - <track src="..."> element: convert subtitles to data uri and    */
/*       use this to replace url in src attribute.                      */
/*                                                                      */
/*    - <object data="..."> element: convert binary data to data uri    */
/*       and use these to replace url in data attribute.                */
/*                                                                      */
/*    - <embed src="..."> element: convert binary data to data uri      */
/*       and use this to replace url in src attribute.                  */
/*                                                                      */
/*    - <frame src="..."> element: process sub-tree to extract HTML,    */
/*       then convert HTML to data uri and use this to replace url in   */
/*       src attribute.                                                 */
/*                                                                      */
/*    - <iframe src="..."> or <iframe srcdoc="..."> element: process    */
/*       sub-tree to extract HTML, then convert HTML to text and use    */
/*       this to replace text in srcdoc attribute or to create new      */
/*       srcdoc attribute.                                              */
/*                                                                      */
/*    - <iframe src="..."> element: replace url in srcdoc attribute     */
/*       by empty string.                                               */
/*                                                                      */
/*    - other elements: process child nodes to extract HTML.            */
/*                                                                      */
/*    - text nodes: escape '<' and '>' characters.                      */
/*                                                                      */
/*    - comment nodes: enclose within <!-- and  -->                     */
/*                                                                      */
/* 9. Data URI syntax and defaults:                                     */
/*                                                                      */
/*    - data:[<media type>][;base64],<encoded data>                     */
/*                                                                      */
/*    - where <media type> is: <mime type>[;charset=<charset>]          */
/*                                                                      */
/*    - default for text content: text/plain;charset=US-ASCII           */
/*                                                                      */
/*    - default for binary content: application/octet-stream;base64     */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Potential Improvements                                               */
/*                                                                      */
/* 1. The main document and <frame> and <iframe> documents could be     */
/*    downloaded and parsed to extract the original states of the       */
/*    HTML elements, as an alternative to the current states.           */
/*                                                                      */
/* 2. <script src="..."> element could be converted to <script>         */
/*    element to avoid data uri in href attribute, which would also     */
/*    avoid using encodeURIComponent(), but any 'async' or 'defer'      */
/*    attributes would be lost and the order of execution of scripts    */
/*    could change.                                                     */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* General Handling of URLs                                             */
/*                                                                      */
/* HTML                                                                 */
/*                                                                      */
/* 1. <a> and <area> elements:                                          */
/*                                                                      */
/*    - absolute and relative URLs with fragment identifiers that       */
/*      point to the same page are converted to fragment-only URLs.     */
/*                                                                      */
/*    - other relative URLs are converted to absolute URLs.             */
/*                                                                      */
/* 2. Other elements: the contents of absolute and relative URLs        */
/*    are saved as data URIs.                                           */
/*                                                                      */
/* 3. Unsaved URLs are converted to absolute URLs.                      */
/*                                                                      */
/* SVG                                                                  */
/*                                                                      */
/* 1. <a> elements:                                                     */
/*                                                                      */
/*    - absolute and relative URLs with fragment identifiers that       */
/*      point to the same page are converted to fragment-only URLs.     */
/*                                                                      */
/*    - other relative URLs are converted to absolute URLs.             */
/*                                                                      */
/* 2. <image> elements: the contents of absolute and relative URLs      */
/*    are saved as data URIs.                                           */
/*                                                                      */
/* 4. Other elements: the contents of absolute and relative URLs        */
/*    are saved as data URIs.                                           */
/*                                                                      */
/* 5. Unsaved URLs are converted to absolute URLs.                      */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Specific Handling of URLs in HTML and SVG Attributes                 */
/*                                                                      */
/* HTML Element    Attribute    HTML    Content        Handling         */
/*                                                                      */
/* <a>             href          4 5    -              -                */
/* <applet>        codebase      4      java           -                */
/* <area>          href          4 5    -              -                */
/* <audio>         src             5    audio          data uri   (1)   */
/* <base>          href          4 5    -              -                */
/* <blockquote>    cite          4 5    info           -                */
/* <body>          background    4      image          data uri         */
/* <button>        formaction      5    -              -                */
/* <canvas>        -               5    graphics       data uri   (2)   */
/* <del>           cite          4 5    info           -                */
/* <embed>         src             5    data           data uri         */
/* <form>          action        4 5    -              -                */
/* <frame>         longdesc      4      info           -                */
/* <frame>         src           4      html           data uri   (3)   */
/* <head>          profile       4      metadata       -                */
/* <html>          manifest        5    -              -                */
/* <iframe>        longdesc      4      info           -                */
/* <iframe>        src           4 5    html           html text  (4)   */
/* <iframe>        srcdoc          5    html           html text  (4)   */
/* <img>           longdesc      4      info           -                */
/* <img>           src           4 5    image          data uri         */
/* <img>           srcset          5    images         -          (5)   */
/* <input>         formaction      5    -              -                */
/* <input>         src           4 5    image          data uri         */
/* <ins>           cite          4 5    info           -                */
/* <link>          href          4 5    css            style      (6)   */
/* <link>          href          4 5    icon           data uri         */
/* <object>        archive       4      -              -                */
/* <object>        classid       4      -              -                */
/* <object>        codebase      4      -              -                */
/* <object>        data          4 5    data           data uri         */
/* <q>             cite          4 5    info           -                */
/* <script>        src           4 5    javscript      data uri         */
/* <source>        src             5    audio/video    data uri   (1)   */
/* <source>        srcset          5    image          -          (5)   */
/* <track>         src             5    audio/video    data uri         */
/* <video>         poster          5    image          data uri         */
/* <video>         src             5    video          data uri   (1)   */
/*                                                                      */
/* SVG Element     Attribute    SVG     Content        Handling         */
/*                                                                      */
/* <a>             href        1.1 2    -              -                */
/* <image>         href        1.1 2    image or svg   data uri         */
/* other           href        1.1 2    svg            data uri   (7)   */
/*                                                                      */
/* Notes:                                                               */
/*                                                                      */
/* (1) data uri is created only if the URL in the 'src' attribute       */
/*     is the same as the URL in element.currentSrc of the related      */
/*     <audio> or <video> element.                                      */
/*                                                                      */
/* (2) data uri is created by calling element.toDataURL() and is        */
/*     used to define background image in the 'style' attribute.        */
/*                                                                      */
/* (3) data uri is created by processing the frame's HTML sub-tree.     */
/*     Frame content is usually determined by URL in 'src' attribute,   */
/*     but this is not used directly. Frame content may also have       */
/*     been set programmatically.                                       */
/*                                                                      */
/* (4) html text is created by processing the frame's HTML sub-tree.    */
/*     URL in 'src' attribute and HTML text in 'srcdoc' attribute       */
/*     determine frame content, but are not used directly; or frame     */
/*     Frame content is usually determined by URL in 'src' attribute    */
/*     and HTML text in 'srcdoc' attribute, but these are not used      */
/*     directly. Frame content may also have been set programmatically. */
/*                                                                      */
/* (5) if the URL in element.currentSrc is not the same as the URL      */
/*     in the 'src' attribute, it is assumed to be one of the URLs      */
/*     in the 'srcset' attributes, and the 'src' attribute is set to    */
/*     this URL and the 'srcset' attributes are set to empty strings.   */
/*                                                                      */
/* (6) replace <link> element with <style> element containing the       */
/*     style sheet referred to by the URL in the 'href' attribute.      */
/*                                                                      */
/* (7) applies to URLs in 'href' or 'xlink:href' attributes.            */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Handling of Binary Data and Characters                               */
/*                                                                      */
/* 1. Files downloaded by XMLHttpRequest GET request are received       */
/*    as a Uint8Array (8-bit unsigned integers) representing:           */
/*    - either binary data (image, font, audio or video)                */
/*    - or encoded characters (style sheets or scripts)                 */
/*                                                                      */
/* 2. The Uint8Array is then converted to a Javascript string           */
/*    (16-bit unsigned integers) containing 8-bit unsigned values       */
/*    (a binary string) which is sent to the content script.            */
/*                                                                      */
/* 3. A binary string containing binary data is copied directly         */
/*    into the resourceContent array.                                   */
/*                                                                      */
/* 4. A binary string containing UTF-8 characters is converted to       */
/*    a normal Javascript string (containing UTF-16 characters)         */
/*    before being copied into the resourceContent array.               */
/*                                                                      */
/* 5. A binary string containing non-UTF-8 (ASCII, ANSI, ISO-8859-1)    */
/*    characters is copied directly into the resourceContent array.     */
/*                                                                      */
/* 6. When creating a Base64 data uri, the binary string from the       */
/*    resourceContent array is converted to a Base64 ASCII string       */
/*    using btoa().                                                     */
/*                                                                      */
/* 7. When creating a UTF-8 data uri, the UTF-16 string from the        */
/*    resourceContent array is converted to a UTF-8 %-escaped           */
/*    string using encodeURIComponent(). The following characters       */
/*    are not %-escaped: alphabetic, digits, - _ . ! ~ * ' ( )          */
/*                                                                      */
/* 8. Character encodings are determined as follows:                    */
/*    - UTF-8 Byte Order Mark (BOM) at the start of a text file         */
/*    - charset parameter in the HTTP Content-Type header field         */
/*    - @charset rule at the start of a style sheet                     */
/*    - charset attribute on an element referencing a text file         */
/*    - charset encoding of the parent document or style sheet          */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* IFrames and Frames - Firefox and Chrome Test Results                 */
/*                                                                      */
/*                                       Firefox           Chrome       */
/*                                   Loads  cD   dE    Loads  cD   dE   */
/* <iframe>                                                             */
/*                                                                      */
/* src="data:..."                     yes   no   no     yes*  no   no   */
/* src="blob:..."                     yes  yes  yes     yes*  no   no   */
/*                                                                      */
/* srcdoc="html"                      yes  yes   no     yes  yes  yes   */
/* srcdoc="html" sandbox=""           yes   no   no     yes   no   no   */
/* srcdoc="html" sandbox="aso"        yes  yes   no     yes  yes  yes   */
/*                                                                      */
/* <frame>                                                              */
/*                                                                      */
/* src="data:..."                     yes   no   no     yes   no   no   */
/* src="blob:..."                     yes  yes  yes     yes   no   no   */
/*                                                                      */
/* aso = allow-same-origin                                              */
/* cD = frame.contentDocument accessible                                */
/* dE = frame.contentDocument.documentElement accessible                */
/* yes* = loads but there are issues with <audio> elements              */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Maximum Total Size of Resources - Windows 10 Test Results            */
/*                                                                      */
/* Browser                Maximum      Limit                            */
/*                                                                      */
/* Chrome 56 (32-bit)      ~691MB      500MB                            */
/* Chrome 56 (64-bit)      ~338MB      250MB                            */
/*                                                                      */
/* Chrome 67 (32-bit)      ~691MB      500MB                            */
/* Chrome 67 (64-bit)      ~338MB      250MB                            */
/*                                                                      */
/* Firefox 52 (32-bit)     ~184MB      150MB                            */
/* Firefox 52 (64-bit)     ~185MB      150MB                            */
/*                                                                      */
/* Firefox 55 (32-bit)     ~537MB      400MB                            */
/* Firefox 55 (64-bit)    >1536MB     1000MB                            */
/*                                                                      */
/* Firefox 62 (32-bit)     ~522MB      400MB                            */
/* Firefox 62 (64-bit)    >1536MB     1000MB                            */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Tab Page Types                                                       */
/*                                                                      */
/*  0 = Normal Page                                                     */
/*  1 = Saved Page                                                      */
/*  2 = Saved Page with Resource Loader                                 */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Tab Save States                                                      */
/*                                                                      */
/* -2 = Before Navigate                                                 */
/* -1 = Script loaded (page loaded)                                     */
/*  0 = Lazy Loads                                                      */
/*  1 = First Pass                                                      */
/*  2 = Second Pass                                                     */
/*  3 = Third Pass                                                      */
/*  4 = Remove Resource Loader                                          */
/*  5 = Extract Image/Audio/Video                                       */
/*  6 = Saved                                                           */
/*  7 = Removed                                                         */
/*  8 = Extracted                                                       */
/*                                                                      */
/************************************************************************/

"use strict";

/************************************************************************/

/* Global variables - reinitialized when service worker is reloaded */

var debugEnable = false;

/************************************************************************/

/* Initialize on session startup */

chrome.runtime.getPlatformInfo(
function(PlatformInfo)   
{
    var isfirefox,platformos,platformarch;
    
    isfirefox = (chrome.runtime.getURL("/").substr(0,14) == "moz-extension:");
    
    platformos = PlatformInfo.os;
    
    platformarch = PlatformInfo.arch;
    
    chrome.storage.local.set({ "environment-isfirefox": isfirefox, "environment-platformos": platformos, "environment-platformarch": platformarch });
    
    /* Service worker reload state */
    
    chrome.action.getBadgeBackgroundColor({ },
    function(colorArray)
    {
        if ((isfirefox && colorArray[0] == 217 && colorArray[1] == 0 && colorArray[2] == 0 && colorArray[3] == 255) ||
            (!isfirefox && colorArray[0] == 0 && colorArray[1] == 0 && colorArray[2] == 0 && colorArray[3] == 0))  /* first load of service worker */
        {
            chrome.action.setBadgeBackgroundColor({ color: [ 127, 127, 127, 127 ] });
            
            initialize(isfirefox,platformos);
        }
    });
    
    /* Extension identifiers */
    
    if (isfirefox)
    {
        chrome.storage.local.set({ "environment-printeditid": "printedit-we@DW-dev" });
    }
    else
    {
        chrome.management.getSelf(
        function(extensionInfo)
        {
            var printeditid;
            
            printeditid = (extensionInfo.installType == "normal") ? "olnblpmehglpcallpnbgmikjblmkopia" : "efiacbjahjnpgmbbebanlcclacbfaajf";  /* normal or development */
            
            chrome.storage.local.set({ "environment-installtype": extensionInfo.installType, "environment-printeditid": printeditid });
        });
    }
});

function initialize(isfirefox,platformos)
{
    chrome.storage.local.get(null,
    function(local)
    {
        var title;
        var contexts = [];
        
        /* Initialize options */
        
        /* General options */
        
        if (!("options-buttonactiontype" in local)) local["options-buttonactiontype"] = 0;
        if (!("options-buttonactionitems" in local)) local["options-buttonactionitems"] = 1;
        
        if (!("options-showsubmenu" in local)) local["options-showsubmenu"] = true;
        if (!("options-showwarning" in local)) local["options-showwarning"] = true;
        if (!("options-showresources" in local)) local["options-showresources"] = false;
        if (!("options-promptcomments" in local)) local["options-promptcomments"] = false;
        if (!("options-skipwarningscomments" in local)) local["options-skipwarningscomments"] = true;
        if (!("options-usenewsavemethod" in local)) local["options-usenewsavemethod"] = false;
        if (!("options-showsaveasdialog" in local)) local["options-showsaveasdialog"] = false;
        if (!("options-closetabafter" in local)) local["options-closetabafter"] = false;
        
        if (!("options-loadlazycontent" in local)) local["options-loadlazycontent"] = false;
        if (!("options-lazyloadtype" in local)) local["options-lazyloadtype"] = "0";
        if (!("options-loadlazyimages" in local)) local["options-loadlazyimages"] = true;
        if (!("options-retaincrossframes" in local)) local["options-retaincrossframes"] = true;
        if (!("options-mergecssimages" in local)) local["options-mergecssimages"] = true;
        if (!("options-executescripts" in local)) local["options-executescripts"] = false;
        if (!("options-removeunsavedurls" in local)) local["options-removeunsavedurls"] = true;
        if (!("options-removeelements" in local)) local["options-removeelements"] = false;
        if (!("options-rehideelements" in local)) local["options-rehideelements"] = false;
        if (!("options-includeinfobar" in local)) local["options-includeinfobar"] = false;
        if (!("options-includesummary" in local)) local["options-includesummary"] = false;
        if (!("options-formathtml" in local)) local["options-formathtml"] = false;
        
        /* Saved Items options */
        
        if (!("options-savehtmlimagesall" in local)) local["options-savehtmlimagesall"] = false;
        if (!("options-savehtmlaudiovideo" in local)) local["options-savehtmlaudiovideo"] = false;
        if (!("options-savehtmlobjectembed" in local)) local["options-savehtmlobjectembed"] = false;
        if (!("options-savecssimagesall" in local)) local["options-savecssimagesall"] = false;
        if (!("options-savecssfontswoff" in local)) local["options-savecssfontswoff"] = false;
        if (!("options-savecssfontsall" in local)) local["options-savecssfontsall"] = false;
        if (!("options-savescripts" in local)) local["options-savescripts"] = false;
        
        /* File Info options */
        
        if (!("options-urllisturls" in local)) local["options-urllisturls"] = [];
        if (!("options-urllistname" in local)) local["options-urllistname"] = "";
        
        if (!("options-savedfilename" in local)) local["options-savedfilename"] = "%TITLE%";
        if (!("options-replacespaces" in local)) local["options-replacespaces"] = false;
        if (!("options-replacechar" in local)) local["options-replacechar"] = "-";
        if (!("options-maxfilenamelength" in local)) local["options-maxfilenamelength"] = 150;
        
        /* Advanced options */
        
        if (!("options-maxpagetime" in local)) local["options-maxpagetime"] = 10;
        
        if (!("options-savedelaytime" in local)) local["options-savedelaytime"] = 0;
        
        if (!("options-lazyloadscrolltime" in local)) local["options-lazyloadscrolltime"] = 0.2;
        if (!("options-lazyloadshrinktime" in local)) local["options-lazyloadshrinktime"] = 0.5;
        
        if (!("options-maxframedepth" in local)) local["options-maxframedepth"] = 5;
        
        if (!("options-maxresourcesize" in local)) local["options-maxresourcesize"] = 50;
        
        if (!("options-maxresourcetime" in local)) local["options-maxresourcetime"] = 10;
        
        if (!("options-allowpassive" in local)) local["options-allowpassive"] = false;
        
        if (!("options-crossorigin" in local)) local["options-crossorigin"] = 0;
        
        if (!("options-useautomation" in local)) local["options-useautomation"] = false;
        
        /* Tabs settings */
        
        local["tabs-highlightcount"] = 0;
        
        delete local["tabs-pagetype"];
        local["tabs-pagetype"] = {};
        
        delete local["tabs-savestate"];
        local["tabs-savestate"] = {};
        
        /* Actions settings */
        
        local["actions-automation"] = local["options-useautomation"];
        
        local["actions-cancelsave"] = false;
        
        delete local["actions-details"];
        local["actions-details"] = {};
        
        /* Update local storage */
        
        chrome.storage.local.set(local);
        
        /* Create context menu items */
        
        chrome.contextMenus.removeAll(
        function()
        {
            contexts = local["options-showsubmenu"] ? [ "all" ] : [ "action" ];
            title = local["options-loadlazycontent"] ? "Without " : "With ";
            title += (local["options-lazyloadtype"] == "0") ? "Scroll:" : "Shrink:";
            
            chrome.contextMenus.create({ id: "saveselectedtabs", title: "Save Selected Tabs", contexts: contexts, enabled: true });
            chrome.contextMenus.create({ id: "savelistedurls", title: "Save Listed URLs", contexts: contexts, enabled: true });
            chrome.contextMenus.create({ id: "cancelsave", title: "Cancel Save", contexts: contexts, enabled: true });
            chrome.contextMenus.create({ id: "viewpageinfo", title: "View Saved Page Info", contexts: contexts, enabled: true });
            chrome.contextMenus.create({ id: "removeresourceloader", title: "Remove Resource Loader", contexts: contexts, enabled: true });
            chrome.contextMenus.create({ id: "extractmedia", title: "Extract Image/Audio/Video", contexts: [ "image","audio","video" ], enabled: true });
            
            chrome.contextMenus.create({ id: "saveselectedtabs-basicitems", parentId: "saveselectedtabs", title: "Basic Items", contexts: [ "all" ], enabled: true });
            chrome.contextMenus.create({ id: "saveselectedtabs-standarditems", parentId: "saveselectedtabs", title: "Standard Items", contexts: [ "all" ], enabled: true });
            chrome.contextMenus.create({ id: "saveselectedtabs-customitems", parentId: "saveselectedtabs", title: "Custom Items", contexts: [ "all" ], enabled: true });
            chrome.contextMenus.create({ id: "saveselectedtabs-sep-1", type: "separator", parentId: "saveselectedtabs", contexts: [ "all" ], enabled: true });
            chrome.contextMenus.create({ id: "saveselectedtabs-w-title", parentId: "saveselectedtabs", title: title, contexts: [ "all" ], enabled: false });
            chrome.contextMenus.create({ id: "saveselectedtabs-w-basicitems", parentId: "saveselectedtabs", title: "Basic Items", contexts: [ "all" ], enabled: true });
            chrome.contextMenus.create({ id: "saveselectedtabs-w-standarditems", parentId: "saveselectedtabs", title: "Standard Items", contexts: [ "all" ], enabled: true });
            chrome.contextMenus.create({ id: "saveselectedtabs-w-customitems", parentId: "saveselectedtabs", title: "Custom Items", contexts: [ "all" ], enabled: true });
            
            chrome.contextMenus.create({ id: "savelistedurls-basicitems", parentId: "savelistedurls", title: "Basic Items", contexts: [ "all" ], enabled: true });
            chrome.contextMenus.create({ id: "savelistedurls-standarditems", parentId: "savelistedurls", title: "Standard Items", contexts: [ "all" ], enabled: true });
            chrome.contextMenus.create({ id: "savelistedurls-customitems", parentId: "savelistedurls", title: "Custom Items", contexts: [ "all" ], enabled: true });
            chrome.contextMenus.create({ id: "savelistedurls-sep-1", type: "separator", parentId: "savelistedurls", contexts: [ "all" ], enabled: true });
            chrome.contextMenus.create({ id: "savelistedurls-w-title", parentId: "savelistedurls", title: title, contexts: [ "all" ], enabled: false });
            chrome.contextMenus.create({ id: "savelistedurls-w-basicitems", parentId: "savelistedurls", title: "Basic Items", contexts: [ "all" ], enabled: true });
            chrome.contextMenus.create({ id: "savelistedurls-w-standarditems", parentId: "savelistedurls", title: "Standard Items", contexts: [ "all" ], enabled: true });
            chrome.contextMenus.create({ id: "savelistedurls-w-customitems", parentId: "savelistedurls", title: "Custom Items", contexts: [ "all" ], enabled: true });
        });
        
        /* Update browser action and context menus for first tab */
        /* Perform Button Action on browser startup */
        
        chrome.tabs.query({ lastFocusedWindow: true, active: true },
        function(tabs)
        {
            /* Initialize states for first tab */
            
            if (!specialPage(tabs[0].url))
            {
                chrome.scripting.executeScript({ target: { tabId: tabs[0].id, frameIds: [0] }, func: getPageType, world: "ISOLATED" },
                function(results)
                {
                    if (results[0].result >= 1)
                    {
                        local["tabs-pagetype"][tabs[0].id] = results[0].result;
                        local["tabs-savestate"][tabs[0].id] = -2;
                    }
                    
                    chrome.storage.local.set({ "tabs-pagetype": local["tabs-pagetype"], "tabs-savestate": local["tabs-savestate"] });
                    
                    updateAction(tabs[0],local);
                    
                    updateContextMenus(tabs[0],local);
                });
            }
            else  /* special page */
            {
                if (local["tabs-pagetype"][tabs[0].id]) local["tabs-pagetype"][tabs[0].id] = 0;
                if (local["tabs-savestate"][tabs[0].id]) local["tabs-savestate"][tabs[0].id] = -2;
                    
                chrome.storage.local.set({ "tabs-pagetype": local["tabs-pagetype"], "tabs-savestate": local["tabs-savestate"] });
                
                updateAction(tabs[0],local);
                
                updateContextMenus(tabs[0],local);
            }
            
            /* Automatic save on startup */
            
            if (local["actions-automation"])
            {
                initiateAction(local["options-buttonactiontype"],local["options-buttonactionitems"],false,null,false,false,local);
            }
        });
    });
}

/************************************************************************/

/* Add listeners */

/* Storage changed listener */

chrome.storage.onChanged.addListener(
function(changes,areaName)
{
    chrome.storage.local.get(null,
    function(local)
    {
        if ("options-buttonactiontype" in changes || "options-showsubmenu" in changes || "options-urllisturls" in changes ||
            "options-loadlazycontent"  in changes || "options-lazyloadtype"  in changes || "tabs-highlightcount" in changes)
        {
            chrome.tabs.query({ lastFocusedWindow: true, active: true },
            function(tabs)
            {
                updateAction(tabs[0],local);
                
                updateContextMenus(tabs[0],local);
            });
        }
    });
});

/* Browser action listener */

chrome.action.onClicked.addListener(
function(tab)
{
    chrome.storage.local.get(null,
    function(local)
    {
        initiateAction(local["options-buttonactiontype"],local["options-buttonactionitems"],false,null,false,false,local);
    });
});

/* Keyboard command listener */

chrome.commands.onCommand.addListener(
function(command)
{
    chrome.storage.local.get(null,
    function(local)
    {
        if (command == "cancelsave")
        {
            cancelAction(local);
        }
    });
});

/* Context menu listener */

chrome.contextMenus.onClicked.addListener(
function(clickData,tab)
{
    chrome.storage.local.get(null,
    function(local)
    {
        if (clickData.menuItemId == "saveselectedtabs-basicitems") initiateAction(0,0,false,null,false,false,local);
        else if (clickData.menuItemId == "saveselectedtabs-standarditems") initiateAction(0,1,false,null,false,false,local);
        else if (clickData.menuItemId == "saveselectedtabs-customitems") initiateAction(0,2,false,null,false,false,local);
        else if (clickData.menuItemId == "saveselectedtabs-w-basicitems") initiateAction(0,0,true,null,false,false,local);
        else if (clickData.menuItemId == "saveselectedtabs-w-standarditems") initiateAction(0,1,true,null,false,false,local);
        else if (clickData.menuItemId == "saveselectedtabs-w-customitems") initiateAction(0,2,true,null,false,false,local);
        else if (clickData.menuItemId == "savelistedurls-basicitems") initiateAction(1,0,false,null,false,false,local);
        else if (clickData.menuItemId == "savelistedurls-standarditems") initiateAction(1,1,false,null,false,false,local);
        else if (clickData.menuItemId == "savelistedurls-customitems") initiateAction(1,2,false,null,false,false,local);
        else if (clickData.menuItemId == "savelistedurls-w-basicitems") initiateAction(1,0,true,null,false,false,local);
        else if (clickData.menuItemId == "savelistedurls-w-standarditems") initiateAction(1,1,true,null,false,false,local);
        else if (clickData.menuItemId == "savelistedurls-w-customitems") initiateAction(1,2,true,null,false,false,local);
        else if (clickData.menuItemId == "cancelsave") cancelAction(local);
        else if (clickData.menuItemId == "viewpageinfo") initiateAction(2,null,null,null,false,false,local);
        else if (clickData.menuItemId == "removeresourceloader") initiateAction(3,null,null,null,false,false,local);
        else if (clickData.menuItemId == "extractmedia") initiateAction(4,null,null,clickData.srcUrl,false,false,local);
    });
});

/* Tab event listeners */

chrome.tabs.onActivated.addListener(  /* tab selected */
function(activeInfo)
{
    chrome.storage.local.get(null,
    function(local)
    {
        chrome.tabs.get(activeInfo.tabId,
        function(tab)
        {
            if (chrome.runtime.lastError == null)  /* in case tab does not exist */
            {
                updateAction(tab,local);
                
                updateContextMenus(tab,local);
            }
        });
    });
});

chrome.tabs.onHighlighted.addListener(  /* tab highlighted */
function(highlightInfo)
{
    chrome.storage.local.get(null,
    function(local)
    {
        local["tabs-highlightcount"] = highlightInfo.tabIds.length;
        
        chrome.storage.local.set({ "tabs-highlightcount": local["tabs-highlightcount"] });       
        
        chrome.tabs.query({ lastFocusedWindow: true, active: true },
        function(tabs)
        {
            updateAction(tabs[0],local);
            
            updateContextMenus(tabs[0],local);
        });
    });
});

chrome.tabs.onUpdated.addListener(  /* URL updated */
function(tabId,changeInfo,tab)
{
    chrome.storage.local.get(null,
    function(local)
    {
        updateAction(tab,local);
        
        updateContextMenus(tab,local);
    });
});

/* Web navigation listeners */

chrome.webNavigation.onBeforeNavigate.addListener(
function(details)
{
    chrome.storage.local.get(null,
    function(local)
    {
        chrome.tabs.get(details.tabId,
        function(tab)
        {
            if (chrome.runtime.lastError == null)  /* in case tab does not exist */
            {
                if (details.frameId == 0)
                {
                    if (local["tabs-pagetype"][details.tabId]) local["tabs-pagetype"][details.tabId] = 0;
                    if (local["tabs-savestate"][details.tabId]) local["tabs-savestate"][details.tabId] = -2;
                    
                    chrome.storage.local.set({ "tabs-pagetype": local["tabs-pagetype"], "tabs-savestate": local["tabs-savestate"] });
                    
                    updateAction(tab,local);
                    
                    updateContextMenus(tab,local);
                }
            }
        });
    });
});

chrome.webNavigation.onCompleted.addListener(  /* page loaded or (Firefox) extracted resource downloaded */
function(details)
{
    chrome.storage.local.get(null,
    function(local)
    {
        chrome.tabs.get(details.tabId,
        function(tab)
        {
            if (chrome.runtime.lastError == null)  /* in case tab does not exist */
            {
                if (details.frameId == 0 && details.url != tab.url) return;  /* Firefox - workaround for when download popup window opens - see Bug 1441474 */
                
                if (details.frameId == 0)
                {
                    if (!specialPage(details.url))
                    {
                        chrome.scripting.executeScript({ target: { tabId: details.tabId, frameIds: [ 0 ] }, func: getPageType, world: "ISOLATED" },
                        function(results)
                        {
                            if (results[0].result >= 1)
                            {
                                local["tabs-pagetype"][details.tabId] = results[0].result;
                                local["tabs-savestate"][details.tabId] = -2;
                                
                                chrome.storage.local.set({ "tabs-pagetype": local["tabs-pagetype"], "tabs-savestate": local["tabs-savestate"] });
                            }
                            
                            updateAction(tab,local);
                            
                            updateContextMenus(tab,local);
                        });
                    }
                }
            }
        });
    });
});

/* Message received listener */

chrome.runtime.onMessage.addListener(
function(message,sender,sendResponse)
{
    chrome.storage.local.get(null,
    function(local)
    {
        switch (message.type)
        {
            /* Messages from content script */
            
            case "getTabId":
                
                sendResponse({ tabid: sender.tab.id });
                
                break;
                
            case "getFiles":
                
                fetchExtensionFiles(sendResponse);
                
                break;
                
            case "scriptLoaded":
                
                local["tabs-pagetype"][sender.tab.id] = message.pagetype;
                local["tabs-savestate"][sender.tab.id] = message.savestate;
                
                chrome.storage.local.set({ "tabs-pagetype": local["tabs-pagetype"], "tabs-savestate": local["tabs-savestate"] });
                
                updateAction(sender.tab,local);
                
                updateContextMenus(sender.tab,local);
                
                chrome.tabs.sendMessage(sender.tab.id,{ type: "performAction",
                                                        menuaction: local["actions-details"][sender.tab.id].menuaction,
                                                        saveditems: local["actions-details"][sender.tab.id].saveditems,
                                                        togglelazy: local["actions-details"][sender.tab.id].togglelazy,
                                                        extractsrcurl: local["actions-details"][sender.tab.id].extractsrcurl,
                                                        externalsave: local["actions-details"][sender.tab.id].externalsave,
                                                        swapdevices: local["actions-details"][sender.tab.id].swapdevices,
                                                        multiplesaves: local["actions-details"][sender.tab.id].multiplesaves },checkError);
                
                break;
                
            case "stateChanged":
                
                local["tabs-pagetype"][sender.tab.id] = message.pagetype;
                local["tabs-savestate"][sender.tab.id] = message.savestate;
                
                chrome.storage.local.set({ "tabs-pagetype": local["tabs-pagetype"], "tabs-savestate": local["tabs-savestate"] });
                
                updateAction(sender.tab,local);
                
                updateContextMenus(sender.tab,local);
                
                break;
                
            case "setDelay":
                
                setTimeout(function() { sendResponse({ }); },message.milliseconds);
                
                return true;  /* asynchronous response */
                
            case "selectTab":
                
                chrome.tabs.update(sender.tab.id,{ active: true });
                
                break;
                
            case "requestFrames":
                
                chrome.tabs.sendMessage(sender.tab.id,{ type: "requestFrames" },checkError);
                
                break;
                
            case "replyFrame":
                
                chrome.tabs.sendMessage(sender.tab.id,{ type: "replyFrame", key: message.key, url: message.url, html: message.html, fonts: message.fonts },checkError);
                
                break;
                
            case "loadResource":
                
                chrome.tabs.get(sender.tab.id,
                function(tab)
                {
                    /* Verify message sender */
                    
                    if (sender.id == chrome.runtime.id && sender.frameId == 0 && sender.url == tab.url && sender.origin == (new URL(tab.url)).origin)
                    {
                        loadResource(sender.tab.id,message.index,message.location,message.referrer,message.referrerPolicy,local);
                    }
                    else
                    {
                        chrome.tabs.sendMessage(sender.tab.id,{ type: "loadFailure", index: message.index, reason: "ignored*" },checkError);
                    }
                });
                
                break;
                
            case "saveExit":
                
                local["tabs-pagetype"][sender.tab.id] = message.pagetype;
                local["tabs-savestate"][sender.tab.id] = message.savestate;
                
                chrome.storage.local.set({ "tabs-pagetype": local["tabs-pagetype"], "tabs-savestate": local["tabs-savestate"] });
                
                updateAction(sender.tab,local);
                
                updateContextMenus(sender.tab,local);
                
                finishAction(sender.tab.id,false,local);
                
                break;
                
            case "saveDone":
                
                local["tabs-pagetype"][sender.tab.id] = message.pagetype;
                local["tabs-savestate"][sender.tab.id] = message.savestate;
                
                chrome.storage.local.set({ "tabs-pagetype": local["tabs-pagetype"], "tabs-savestate": local["tabs-savestate"] });
                
                updateAction(sender.tab,local);
                
                updateContextMenus(sender.tab,local);
                
                finishAction(sender.tab.id,message.success,local);
                
                break;
        }
    });
    
    if (message.type == "getTabId" || message.type == "getFiles" || message.type == "setDelay") return true;  /* keep  message channel open for sendResponse */
});

/* External message received listener */

chrome.runtime.onMessageExternal.addListener(
function(message,sender,sendResponse)
{
    chrome.storage.local.get(null,
    function(local)
    {
        switch (message.type)
        {
            /* Messages from another add-on */
            
            case "externalSaveStart":
                
                if (sender.id == local["environment-printeditid"])
                {
                    sendResponse({ });
                    
                    if (message.saveditems >= 0 && message.saveditems <= 2)  /* 0 = basic items, 1 = standard items, 2 = custom items */
                    {
                        chrome.tabs.query({ lastFocusedWindow: true, active: true },
                        function(tabs)
                        {
                            initiateAction(0,message.saveditems,false,null,true,message.swapdevices,local);
                        });
                    }
                    else
                    {
                        chrome.runtime.sendMessage(local["environment-printeditid"],{ type: "externalSaveDone", tabid: sender.tab.id, success: false },checkError);
                    }
                }
                
                break;
                
            case "externalSaveCheck":
                
                if (sender.id == local["environment-printeditid"])
                {
                    sendResponse({ });
                }
                
                break;
        }
    });
    
    if (message.type == "externalSaveStart" || message.type == "externalSaveCheck") return true;  /* keep  message channel open for sendResponse */
});

/************************************************************************/

/* Get content page type function */

function getPageType()
{
    return (document.querySelector("script[id='savepage-pageloader']") != null ||  /* Version 7.0-14.0 */
            document.querySelector("meta[name='savepage-resourceloader']") != null) ? 2 :  /* Version 15.0-15.1 */
            document.querySelector("meta[name='savepage-url']") != null ? 1 : 0;  /* Version 16.0 or later */
}

/************************************************************************/

/* Fetch extension files function */

async function fetchExtensionFiles(sendResponse)
{
    var response;
    var messagePanel,lazyloadPanel,unsavedPanel,commentsPanel,pageinfoPanel;  /* user interface panels */
    var pageinfoBar,shadowLoader;  /* inserted in saved page */
    
    response = await fetch(chrome.runtime.getURL("message-panel.html"),{ method: "GET", mode: "no-cors", cache: "no-cache"});
    messagePanel = await response.text();
    
    response = await fetch(chrome.runtime.getURL("lazyload-panel.html"),{ method: "GET", mode: "no-cors", cache: "no-cache"});
    lazyloadPanel = await response.text();
    
    response = await fetch(chrome.runtime.getURL("unsaved-panel.html"),{ method: "GET", mode: "no-cors", cache: "no-cache"});
    unsavedPanel = await response.text();
    
    response = await fetch(chrome.runtime.getURL("comments-panel.html"),{ method: "GET", mode: "no-cors", cache: "no-cache"});
    commentsPanel = await response.text();
    
    response = await fetch(chrome.runtime.getURL("pageinfo-panel.html"),{ method: "GET", mode: "no-cors", cache: "no-cache"});
    pageinfoPanel = await response.text();
    
    response = await fetch(chrome.runtime.getURL("pageinfo-bar-compressed.html"),{ method: "GET", mode: "no-cors", cache: "no-cache"});
    pageinfoBar = await response.text();
    
    response = await fetch(chrome.runtime.getURL("shadowloader-compressed.js"),{ method: "GET", mode: "no-cors", cache: "no-cache"});
    shadowLoader = await response.text();
    
    sendResponse({ messagepanel: messagePanel, lazyloadpanel: lazyloadPanel, unsavedpanel: unsavedPanel,
                   commentspanel: commentsPanel, pageinfopanel: pageinfoPanel,
                   pageinfobar: pageinfoBar, shadowloader: shadowLoader });
}

/************************************************************************/

/* Load resource function */

async function loadResource(tabid,index,location,referrer,referrerPolicy,local)
{
    var controller,timeout,response;
    var i,contentType,contentLength,mimetype,charset,buffer,byteArray,binaryString;
    var matches = [];
    
    controller = new AbortController();
    
    timeout = setTimeout(
    function()
    {
        controller.abort();
    },local["options-maxresourcetime"]*1000);
    
    try  /* load in background script */
    {
        response = await fetch(location,{ method: "GET", mode: "cors", cache: "no-cache", referrer: referrer, referrerPolicy: referrerPolicy, signal: controller.signal });
        
        if (debugEnable) console.log("Backgrond Fetch - index: " + index + " - status: " + response.status + " - referrer: " + referrer + " - policy: " + referrerPolicy + " - location: " + location);
        
        clearTimeout(timeout);
        
        if (response.status == 200)
        {
            contentType = response.headers.get("Content-Type");
            if (contentType == null) contentType = "";
            
            contentLength = +response.headers.get("Content-Length");
            if (contentLength == null) contentLength = 0;
            
            if (contentLength > local["options-maxresourcesize"]*1024*1024)
            {
                chrome.tabs.sendMessage(tabid,{ type: "loadFailure", index: index, reason: "maxsize*" },checkError);
            }
            else
            {
                matches = contentType.match(/([^;]+)/i);
                if (matches != null) mimetype = matches[1].toLowerCase();
                else mimetype = "";
                
                matches = contentType.match(/;charset=([^;]+)/i);
                if (matches != null) charset = matches[1].toLowerCase();
                else charset = "";
                
                if (mimetype != "text/css" && mimetype != "image/vnd.microsoft.icon" && 
                    mimetype.substr(0,6) != "image/" && mimetype.substr(0,6) != "audio/" && mimetype.substr(0,6) != "video/")
                {
                    /* Block potentially unsafe resource */
                    
                    chrome.tabs.sendMessage(tabid,{ type: "loadFailure", index: index, reason: "blocked*" },checkError);
                    
                    if (debugEnable) console.log("Background Fetch Blocked - index: " + index + " mimetype: " + mimetype + " - location: " + location);
                }
                else
                {
                    buffer = await response.arrayBuffer();
                    
                    byteArray = new Uint8Array(buffer);
                    
                    binaryString = "";
                    for (i = 0; i < byteArray.byteLength; i++) binaryString += String.fromCharCode(byteArray[i]);
                    
                    chrome.tabs.sendMessage(tabid,{ type: "loadSuccess", index: index, reason: "*", content: binaryString, mimetype: mimetype, charset: charset },checkError);
                }
            }
        }
        else
        {
            chrome.tabs.sendMessage(tabid,{ type: "loadFailure", index: index, reason: "load:" + response.status + "*" },checkError);
        }
    }
    catch (e)
    {
        clearTimeout(timeout);
        
        if (e.name == "AbortError")
        {
            chrome.tabs.sendMessage(tabid,{ type: "loadFailure", index: index, reason: "maxtime*" },checkError);
        }
        else
        {
            chrome.tabs.sendMessage(tabid,{ type: "loadFailure", index: index, reason: "fetcherr*" },checkError);
        }
    }
}

/************************************************************************/

/* Initiate/Next/Perform/Finish/Cancel action functions */

/* Each save operation will have multiple sequential save actions when saving multiple tabs */
/* Also there can be multiple save operations in progress at the same time */

function initiateAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,local)
{
    chrome.tabs.query({ lastFocusedWindow: true },
    function(tabs)
    {
        var i,windowid,multiplesaves;
        var selectedtabids = [];
        var listedurls = [];
        
        windowid = tabs[0].windowId;
        
        if (menuaction == 0)
        {
            for (i = 0; i < tabs.length; i++)
            {
                if (tabs[i].highlighted || tabs[i].active || local["actions-automation"])  /* Opera doesn't support highlighted - so check active */
                {
                    if (!specialPage(tabs[i].url)) selectedtabids.push(tabs[i].id);
                }
            }
            
            if (selectedtabids.length == 0)
            {
                alertNotify("No savable pages in selected tabs." + (local["actions-automation"] ? " Automation ended." : ""));
            }
            else
            {
                multiplesaves = (selectedtabids.length > 1);
                
                local["actions-cancelsave"] = false;
                
                chrome.storage.local.set({ "actions-cancelsave": local["actions-cancelsave"] },
                function()
                {
                    nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,local);
                });
            }
        }
        else if (menuaction == 1)
        {
            for (i = 0; i < local["options-urllisturls"].length; i++)
            {
                if (!specialPage(local["options-urllisturls"][i])) listedurls.push(local["options-urllisturls"][i]);
            }
            
            if (listedurls.length == 0)
            {
                alertNotify("No savable pages in Listed URLs." + (local["actions-automation"] ? " Automation ended." : ""));
            }
            else
            {
                multiplesaves = true;
                
                local["actions-cancelsave"] = false;
                
                chrome.storage.local.set({ "actions-cancelsave": local["actions-cancelsave"] },
                function()
                {
                    nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,local);
                });
            }
        }
        else
        {
            for (i = 0; i < tabs.length; i++)
            {
                if (tabs[i].active) selectedtabids.push(tabs[i].id);
            }
            
            multiplesaves = false;
            
            local["actions-cancelsave"] = false;
            
            chrome.storage.local.set({ "actions-cancelsave": local["actions-cancelsave"] },
            function()
            {
                nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,local);
            });
        }
        
        for (i = 0; i < tabs.length; i++)
        {
            if (tabs[i].highlighted && !tabs[i].active) chrome.tabs.update(tabs[i].id,{ highlighted: false });
        }
    });
}

function nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,local)
{
    var currentTabId,timeout,url;
    
    if (menuaction == 0)
    {
        if (local["actions-cancelsave"])
        {
            /* do nothing */
        }
        else if (selectedtabids.length > 0)
        {
            currentTabId = selectedtabids.shift();
            
            chrome.tabs.update(currentTabId,{ active: local["options-loadlazycontent"] },
            function(tab)
            {
                if (tab.status == "complete")
                {
                    performAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,currentTabId,local);
                }
                else
                {
                    chrome.tabs.onUpdated.addListener(listener);
                    
                    function listener(tabId,changeInfo,tab)
                    {
                        if (tab.id == currentTabId && tab.status == "complete")
                        {
                            clearTimeout(timeout);
                            
                            chrome.tabs.onUpdated.removeListener(listener);
                            
                            performAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,currentTabId,local);
                        }
                    }
                    
                    timeout = setTimeout(
                    function()
                    {
                        chrome.tabs.onUpdated.removeListener(listener);
                        
                        nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,local);
                    },local["options-maxpagetime"]*1000);
                }
            });
            
        }
        else if (local["actions-automation"])
        {
            setTimeout(  /* allow time to press Alt+C after saving all tabs */
            function()
            {
                if (!local["actions-cancelsave"])
                {
                    chrome.windows.getLastFocused({ },
                    function(win)
                    {
                        chrome.windows.remove(win.id);  /* remove window used for automation */
                    });
                }
            },2000);
        }
    }
    else if (menuaction == 1)
    {
        if (local["actions-cancelsave"])
        {
            /* do nothing */
        }
        else if (listedurls.length > 0)
        {
            url = listedurls.shift();
            
            chrome.tabs.create({ windowId: windowid, url: url, active: local["options-loadlazycontent"] },
            function(tab)
            {
                currentTabId = tab.id;
                
                chrome.tabs.onUpdated.addListener(listener);
                
                function listener(tabId,changeInfo,tab)
                {
                    if (tab.id == currentTabId && tab.status == "complete")
                    {
                        clearTimeout(timeout);
                        
                        chrome.tabs.onUpdated.removeListener(listener);
                        
                        performAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,currentTabId,local);
                    }
                }
                
                timeout = setTimeout(
                function()
                {
                    chrome.tabs.onUpdated.removeListener(listener);
                    
                    chrome.tabs.remove(currentTabId);  /* remove tab created for saving listed URL */
                    
                    nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,local);
                },local["options-maxpagetime"]*1000);
            });
        }
        else if (local["actions-automation"])
        {
            setTimeout(  /* allow time to press Alt+C after saving all tabs */
            function()
            {
                if (!local["actions-cancelsave"])
                {
                    chrome.windows.getLastFocused({ },
                    function(win)
                    {
                        chrome.windows.remove(win.id);  /* close browser window used for automation */
                    });
                }
            },2000);
        }
    }
    else
    {
        if (selectedtabids.length > 0)
        {
            currentTabId = selectedtabids.shift();
            
            performAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,currentTabId,local);
        }
    }
}

function performAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,currentTabId,local)
{
    chrome.tabs.get(currentTabId,
    function(tab)
    {
        if (chrome.runtime.lastError == null)  /* in case tab does not exist */
        {
            if (specialPage(tab.url))
            {
                alertNotify("Cannot be used with this page:\n > " + tab.title);
                
                nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,local);
            }
            else if (tab.status != "complete")
            {
                alertNotify("Page is not ready:\n > " + tab.title);
                
                nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,local);
            }
            else
            {
                chrome.tabs.sendMessage(tab.id,{ type: "getState" },
                function(response)
                {
                    checkError();
                    
                    if (!response) /* script not loaded */
                    {
                        delete local["actions-details"][tab.id];
                        local["actions-details"][tab.id] = {};
                        
                        local["actions-details"][tab.id].menuaction = menuaction;
                        local["actions-details"][tab.id].saveditems = saveditems;
                        local["actions-details"][tab.id].togglelazy = togglelazy;
                        local["actions-details"][tab.id].extractsrcurl = extractsrcurl;
                        local["actions-details"][tab.id].externalsave = externalsave;
                        local["actions-details"][tab.id].swapdevices = swapdevices;
                        local["actions-details"][tab.id].windowid = windowid;
                        local["actions-details"][tab.id].selectedtabids = selectedtabids;
                        local["actions-details"][tab.id].listedurls = listedurls;
                        local["actions-details"][tab.id].multiplesaves = multiplesaves;
                        
                        chrome.storage.local.set({ "actions-details": local["actions-details"] },
                        function()
                        {
                            var i;
                            var resources = ["message-panel","lazyload-panel","unsaved-panel","comments-panel","pageinfo-panel"];
                            
                            for (i = 0; i < resources.length; i++)
                            {
                                chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: [ resources[i] + ".css" ], origin: "AUTHOR" });
                            }
                            
                            chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [ "content.js"], world: "ISOLATED" });
                            
                            chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: [ "content-frame.js"], world: "ISOLATED" });
                        });
                    }
                    else if (menuaction >= 2 && response.pagetype == 0)  /* view saved page info/remove resource loader/extract image/audio/video - not saved page */
                    {
                        alertNotify("Page is not a saved page:\n > " + tab.title);
                        
                        nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,local);
                    }
                    else
                    {
                        if (response.savestate >= 0 && response.savestate <= 5)  /* operation in progress */
                        {
                            alertNotify("Operation already in progress:\n > " + tab.title);
                            
                            nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,local);
                        }
                        else if (response.savestate == -1 || (response.savestate >= 6 && response.savestate <= 8))  /* script loaded or saved/removed/extracted */
                        {
                            delete local["actions-details"][tab.id];
                            local["actions-details"][tab.id] = {};
                            
                            local["actions-details"][tab.id].menuaction = menuaction;
                            local["actions-details"][tab.id].saveditems = saveditems;
                            local["actions-details"][tab.id].togglelazy = togglelazy;
                            local["actions-details"][tab.id].extractsrcurl = extractsrcurl;
                            local["actions-details"][tab.id].externalsave = externalsave;
                            local["actions-details"][tab.id].swapdevices = swapdevices;
                            local["actions-details"][tab.id].windowid = windowid;
                            local["actions-details"][tab.id].selectedtabids = selectedtabids;
                            local["actions-details"][tab.id].listedurls = listedurls;
                            local["actions-details"][tab.id].multiplesaves = multiplesaves;
                            
                            chrome.storage.local.set({ "actions-details": local["actions-details"] },
                            function()
                            {
                                chrome.tabs.sendMessage(tab.id,{ type: "performAction",
                                                                 menuaction: menuaction,
                                                                 saveditems: saveditems,
                                                                 togglelazy: togglelazy,
                                                                 extractsrcurl: extractsrcurl,
                                                                 externalsave: externalsave,
                                                                 swapdevices: swapdevices,
                                                                 multiplesaves: multiplesaves },checkError);
                            });
                        }
                    }
                });
            }
        }
    });
}

function finishAction(tabId,success,local)
{
    var menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves;
    
    if (local["actions-details"][tabId].externalsave)
    {
        chrome.runtime.sendMessage(local["environment-printeditid"],{ type: "externalSaveDone", tabid: tabId, success: success },checkError);
    }
    
    if (local["actions-details"][tabId].menuaction == 1 || local["options-closetabafter"])
    {
        /* Remove tab created for saving listed URL */
        
        /* Delay necessary to avoid 'No tab with id: <removed tabid>' error message in Chrome */
        
        setTimeout(function() { chrome.tabs.remove(tabId); },50);
    }
    
    menuaction = local["actions-details"][tabId].menuaction;
    saveditems = local["actions-details"][tabId].saveditems;
    togglelazy = local["actions-details"][tabId].togglelazy;
    extractsrcurl = local["actions-details"][tabId].extractsrcurl;
    externalsave = local["actions-details"][tabId].externalsave;
    swapdevices = local["actions-details"][tabId].swapdevices;
    windowid = local["actions-details"][tabId].windowid;
    selectedtabids = local["actions-details"][tabId].selectedtabids;
    listedurls = local["actions-details"][tabId].listedurls;
    multiplesaves = local["actions-details"][tabId].multiplesaves;
    
    delete local["actions-details"][tabId];
    
    chrome.storage.local.set({ "actions-details": local["actions-details"] },
    function()
    {
        nextAction(menuaction,saveditems,togglelazy,extractsrcurl,externalsave,swapdevices,windowid,selectedtabids,listedurls,multiplesaves,local);
    });
}

function cancelAction(local)
{
    local["actions-cancelsave"] = true;
    
    local["actions-automation"] = false;  /* end automation */
    
    chrome.storage.local.set({ "actions-cancelsave": local["actions-cancelsave"], "actions-automation": local["actions-automation"] },
    function()
    {
        var tabId;
        
        for (tabId in local["actions-details"]) 
        {
            chrome.tabs.sendMessage(+tabId,{ type: "cancelSave" },checkError);
        }
    });
}

/************************************************************************/

/* Special page function */

function specialPage(url)
{
    return (url.substr(0,6) == "about:" || url.substr(0,7) == "chrome:" || url.substr(0,12) == "view-source:" ||
            url.substr(0,14) == "moz-extension:" || url.substr(0,26) == "https://addons.mozilla.org" || url.substr(0,27) == "https://support.mozilla.org" ||
            url.substr(0,17) == "chrome-extension:" || url.substr(0,34) == "https://chrome.google.com/webstore");
}

/************************************************************************/

/* Update action function */

function updateAction(tab,local)
{
    if (chrome.runtime.lastError == null && tab && tab.id >= 0 && tab.url != "about:blank")  /* tab not closed or about:blank */
    {
        var pagetype,savestate,loaded,special,enable;
        var saveStateTexts = ["Laz","Sav","Sav","Sav","Rm","Ext","Sav","Rm","Ext",""];
        var saveStateColors = ["#606060","#E00000","#A000D0","#0000E0","#A06000","#008000","#A0A0A0","#A0A0A0","#A0A0A0","#000000"];
        
        pagetype = 0;
        savestate = -1;
        
        if (local["tabs-pagetype"][tab.id]) pagetype = local["tabs-pagetype"][tab.id];
        if (local["tabs-savestate"][tab.id]) savestate = local["tabs-savestate"][tab.id];
        
        loaded = (tab.status == "complete");
        special = specialPage(tab.url);
        enable = (local["tabs-highlightcount"] > 1 || (!special && loaded));
        
        if ((local["options-buttonactiontype"] == 0 && enable) || local["options-buttonactiontype"] == 1)
        {
            chrome.action.enable(tab.id);
            
            chrome.action.setIcon({ tabId: tab.id, path: "icon16.png"});
        }
        else
        {
            chrome.action.disable(tab.id);
            
            chrome.action.setIcon({ tabId: tab.id, path: "icon16-disabled.png"});
        }
        
        if (!loaded) chrome.action.setTitle({ tabId: tab.id, title: "Save Page WE - page is not ready" });
        else if (special) chrome.action.setTitle({ tabId: tab.id, title: "Save Page WE - cannot be used with this page" });
        else if (pagetype == 0) chrome.action.setTitle({ tabId: tab.id, title: "Save Page WE - normal page" });
        else if (pagetype == 1) chrome.action.setTitle({ tabId: tab.id, title: "Save Page WE - saved page" });
        else if (pagetype == 2) chrome.action.setTitle({ tabId: tab.id, title: "Save Page WE - saved page with resource loader" });
        
        if (savestate <= -1) savestate = 9;
        
        chrome.action.setBadgeText({ tabId: tab.id, text: saveStateTexts[savestate] });
        if (local["environment-isfirefox"]) chrome.action.setBadgeTextColor({ tabId: tab.id, color: "#FFFFFF" });
        chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: saveStateColors[savestate] });
    }
}

/************************************************************************/

/* Update context menus function */

function updateContextMenus(tab,local)
{
    var pagetype,savestate,loaded,special,enable,title;
    var contexts = [];
    
    if (chrome.runtime.lastError == null && tab && tab.id >= 0 && tab.url != "about:blank")  /* tab not closed or about:blank */
    {
        pagetype = 0;
        savestate = -1;
        
        if (local["tabs-pagetype"][tab.id]) pagetype = local["tabs-pagetype"][tab.id];
        if (local["tabs-savestate"][tab.id]) savestate = local["tabs-savestate"][tab.id];
        
        contexts = local["options-showsubmenu"] ? [ "all" ] : [ "action" ];
        loaded = (tab.status == "complete");
        special = specialPage(tab.url);
        enable = (local["tabs-highlightcount"] > 1 || (!special && loaded));
        title = local["options-loadlazycontent"] ? "Without " : "With ";
        title += (local["options-lazyloadtype"] == "0") ? "Scroll:" : "Shrink:";
        
        chrome.contextMenus.update("saveselectedtabs",{ contexts: contexts, enabled: (pagetype <= 1 && enable) },checkMenuError);
        
        chrome.contextMenus.update("saveselectedtabs-w-title",{ title: title, enabled: false },checkMenuError);
        
        chrome.contextMenus.update("savelistedurls",{ contexts: contexts, enabled: (local["options-urllisturls"].length > 0) },checkMenuError);
        
        chrome.contextMenus.update("savelistedurls-w-title",{ title: title, enabled: false },checkMenuError);
        
        chrome.contextMenus.update("cancelsave",{ contexts: contexts, enabled: (savestate >= 0 && savestate <= 3) },checkMenuError);
        
        chrome.contextMenus.update("viewpageinfo",{ contexts: contexts, enabled: (pagetype >= 1 && loaded) },checkMenuError);
        
        chrome.contextMenus.update("removeresourceloader",{ contexts: (pagetype == 2) ? contexts : [ "page_action" ], enabled: (pagetype == 2 && loaded) },checkMenuError);
        
        chrome.contextMenus.update("extractmedia",{ contexts: (pagetype >= 1) ? [ "image","audio","video" ] : [ "page_action" ], enabled: (pagetype >= 1 && loaded) },checkMenuError);
    }
}

/************************************************************************/

/* Check for menu create/update/remove errors */

function checkMenuError()
{
    /* Ignore context menu create/remove errors caused by asynchronous execution */
    
    if (chrome.runtime.lastError == null) ;
    else if (chrome.runtime.lastError.message.substr(0,29) == "Cannot find menu item with id") ;  /* Chrome - ignore */
    else if (chrome.runtime.lastError.message.substr(0,36) == "Cannot create item with duplicate id") ;  /* Chrome - ignore */
    else console.log("Save Page WE - " + chrome.runtime.lastError.message);
}

/************************************************************************/

/* Check for sendMessage errors */

function checkError()
{
    if (chrome.runtime.lastError == null) ;
    else if (chrome.runtime.lastError.message == "Could not establish connection. Receiving end does not exist.") ;  /* Chrome & Firefox - ignore */
    else if (chrome.runtime.lastError.message == "The message port closed before a response was received.") ;  /* Chrome - ignore */
    else if (chrome.runtime.lastError.message == "Message manager disconnected") ;  /* Firefox - ignore */
    else console.log("Save Page WE - " + chrome.runtime.lastError.message);
}

/************************************************************************/

/* Display alert notification */

function alertNotify(message)
{
    chrome.notifications.create("alert",{ type: "basic", iconUrl: "icon32.png", title: "SAVE PAGE WE", message: "" + message });
}

/************************************************************************/

/* Display debug notification */

function debugNotify(message)
{
    chrome.notifications.create("debug",{ type: "basic", iconUrl: "icon32.png", title: "SAVE PAGE WE - DEBUG", message: "" + message });
}

/************************************************************************/
