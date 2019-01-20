/************************************************************************/
/*                                                                      */
/*      Save Page WE - Generic WebExtension - Background Page           */
/*                                                                      */
/*      Javascript for Background Page                                  */
/*                                                                      */
/*      Last Edit - 08 Nov 2018                                         */
/*                                                                      */
/*      Copyright (C) 2016-2018 DW-dev                                  */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*      See LICENCE.txt file and http://www.gnu.org/licenses/           */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Refer to Google Chrome developer documentation:                     */
/*                                                                      */
/*  https://developer.chrome.com/extensions/overview                    */
/*  https://developer.chrome.com/extensions/content_scripts             */
/*  https://developer.chrome.com/extensions/messaging                   */
/*  https://developer.chrome.com/extensions/xhr                         */
/*  https://developer.chrome.com/extensions/contentSecurityPolicy       */
/*                                                                      */
/*  https://developer.chrome.com/extensions/manifest                    */
/*  https://developer.chrome.com/extensions/declare_permissions         */
/*  https://developer.chrome.com/extensions/match_patterns              */
/*                                                                      */
/*  https://developer.chrome.com/extensions/browserAction               */
/*  https://developer.chrome.com/extensions/contextMenus                */
/*  https://developer.chrome.com/extensions/downloads                   */
/*  https://developer.chrome.com/extensions/notifications               */
/*  https://developer.chrome.com/extensions/runtime                     */
/*  https://developer.chrome.com/extensions/storage                     */
/*  https://developer.chrome.com/extensions/tabs                        */
/*                                                                      */
/*  Refer to IETF data uri and mime type documentation:                 */
/*                                                                      */
/*  RFC 2397 - https://tools.ietf.org/html/rfc2397                      */
/*  RFC 2045 - https://tools.ietf.org/html/rfc2045                      */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Notes on Save Page WE Operation                                     */
/*                                                                      */
/*  1. The basic approach is to traverse the DOM tree three times,      */
/*     or four times if cross-origin frames are retained.               */
/*                                                                      */
/*  2. The current states of the HTML elements are extracted from       */
/*     the DOM tree. External resources are downloaded and scanned.     */
/*                                                                      */
/*  3. The pre pass identifies and names all unnamed cross-origin       */
/*     frame elements that are reachable from the content script        */
/*     in the main frame.                                               */
/*                                                                      */
/*  4. After the pre pass, content scripts in all frames identify       */
/*     and name most unnamed cross-origin frame elements that are       */
/*     not reachable from the content script in the main frame.         */
/*                                                                      */
/*  5. The first pass gathers external style sheet resources:           */
/*                                                                      */
/*     - <style> element: find style sheet url()'s in @import rules,    */
/*       then remember locations.                                       */
/*                                                                      */
/*     - <link rel="stylesheet" href="..."> element: find style sheet   */
/*       url()'s in @import rules, then remember locations.             */
/*                                                                      */
/*  6. After the first pass, the referenced external style sheets are   */
/*     downloaded from the remembered locations.                        */
/*                                                                      */
/*  7. The second pass gathers external script/font/image resources:    */
/*                                                                      */
/*     - <script> element: remember location from src attribute.        */
/*                                                                      */
/*     - <link rel="icon" href="..."> element: remember location        */
/*       from href attribute.                                           */
/*                                                                      */
/*     - <img> element: remember location from src attribute.           */
/*                                                                      */
/*     if just saving currently displayed CSS images:                   */
/*                                                                      */
/*     - all elements: find url()'s in CSS computed style for element   */
/*       and for before/after pseudo-elements and remember locations.   */
/*                                                                      */
/*     otherwise, if saving all CSS images:                             */
/*                                                                      */
/*     - style attribute on any element: find image url()'s in CSS      */
/*       rules and remember locations.                                  */
/*                                                                      */
/*     - <style> element: handle @import rules, then find font and      */
/*       image url()'s in CSS rules and remember locations.             */
/*                                                                      */
/*     - <link rel="stylesheet" href="..."> element: handle @import     */
/*       rules, then find font and image url()'s in CSS rules and       */
/*       remember locations.                                            */
/*                                                                      */
/*  8. After the second pass, the referenced external resources are     */
/*     downloaded from the remembered locations.                        */
/*                                                                      */
/*  9. The third pass generates HTML and data uri's:                    */
/*                                                                      */
/*     - style attribute on any element: replace image url()'s in       */
/*       CSS rules with data uri's.                                     */
/*                                                                      */
/*     - <script> element: Javascript is not changed.                   */
/*                                                                      */
/*     - <script src="..."> element: convert Javascript to data uri     */
/*       and use this to replace url in src attribute.                  */
/*                                                                      */
/*     - <style> element: handle @import rules, then replace font and   */
/*       image url()'s in CSS rules with data uri's.                    */
/*                                                                      */
/*     - <link rel="stylesheet" href="..."> element: handle @import     */
/*       rules, then replace font and image url()'s in CSS rules        */
/*       with data uri's, then enclose in new <style> element and       */
/*       replace original <link> element.                               */
/*                                                                      */
/*     - <link rel="icon" href="..."> element: convert icon to data     */
/*       uri and use this to replace url in href attribute.             */
/*                                                                      */
/*     - <base href="..." target="..."> element: remove existing        */
/*       base element (if any) and insert new base element with href    */
/*       attribute set to document.baseURI and target attribute set     */
/*       to the same value as for removed base element (if any).        */
/*                                                                      */
/*     - <body background="..."> element: convert image to data uri     */
/*       and use this to replace url in background attribute.           */
/*                                                                      */
/*     - <img src="..."> element: convert current source image to       */
/*       data uri and use this to replace url in src attribute.         */
/*                                                                      */
/*     - <img srcset="..."> element: replace list of images in srcset   */
/*       attribute by null string.                                      */
/*                                                                      */
/*     - <input type="image" src="..."> element: convert image to       */
/*       data uri and use this to replace url in src attribute.         */
/*                                                                      */
/*     - <input type="file"> or <input type="password"> element:        */
/*       no changes made to maintain security.                          */
/*                                                                      */
/*     - <input type="checkbox"> or <input type="radio"> element:       */
/*       add or remove checked attribute depending on the value of      */
/*       element.checked reflecting any user changes.                   */
/*                                                                      */
/*     - <input type="-other-"> element: add value attribute set to     */
/*       element.value reflecting any user changes.                     */
/*                                                                      */
/*     - <audio src="..."> element: if current source, convert audio    */
/*       to data uri and use this to replace url in src attribute.      */
/*                                                                      */
/*     - <video src="..."> element: if current source, convert video    */
/*       to data uri and use this to replace url in src attribute.      */
/*                                                                      */
/*     - <video poster="..."> element: convert image to data uri and    */
/*       use this to replace url in poster attribute.                   */
/*                                                                      */
/*     - <source src="..."> element in <audio> or <video> element:      */
/*       if current source, convert audio or video to data uri and      */
/*       use this to replace url in src attribute.                      */
/*                                                                      */
/*     - <source srcset="..."> element in <picture> element: replace    */
/*       list of images in srcset attribute by null string.             */
/*                                                                      */
/*     - <track src="..."> element: convert subtitles to data uri and   */
/*       use this to replace url in src attribute.                      */
/*                                                                      */
/*     - <object data="..."> element: convert binary data to data uri   */
/*       and use these to replace url in data attribute.                */
/*                                                                      */
/*     - <embed src="..."> element: convert binary data to data uri     */
/*       and use this to replace url in src attribute.                  */
/*                                                                      */
/*     - <frame src="..."> element: process sub-tree to extract HTML,   */
/*       then convert HTML to data uri and use this to replace url in   */
/*       src attribute.                                                 */
/*                                                                      */
/*     - <iframe src="..."> or <iframe srcdoc="..."> element: process   */
/*       sub-tree to extract HTML, then convert HTML to data uri and    */
/*       use this to replace url in src attribute or to create new      */
/*       src attribute.                                                 */
/*                                                                      */
/*     - <iframe srcdoc="..."> element: replace html text in srcdoc     */
/*       attribute by null string.                                      */
/*                                                                      */
/*     - other elements: process child nodes to extract HTML.           */
/*                                                                      */
/*     - text nodes: escape '<' and '>' characters.                     */
/*                                                                      */
/*     - comment nodes: enclose within <!-- and  -->                    */
/*                                                                      */
/* 10. Data URI syntax and defaults:                                    */
/*                                                                      */
/*     - data:[<media type>][;base64],<encoded data>                    */
/*                                                                      */
/*     - where <media type> is: <mime type>[;charset=<charset>]         */
/*                                                                      */
/*     - default for text content: text/plain;charset=US-ASCII          */
/*                                                                      */
/*     - default for binary content: application/octet-stream;base64    */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Potential Improvements                                              */
/*                                                                      */
/*  1. The main document and <frame> and <iframe> documents could be    */
/*     downloaded and scanned to extract the original states of the     */
/*     HTML elements, as an alternative to the current states.          */
/*                                                                      */
/*  2. <script src="..."> element could be converted to <script>        */
/*     element to avoid data uri in href attribute, which would also    */
/*     avoid using encodeURIComponent(), but any 'async' or 'defer'     */
/*     attributes would be lost and the order of execution of scripts   */
/*     could change.                                                    */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Handling of frames and resources                                    */
/*                                                                      */
/*                        No Page Loader    Use Page Loader             */
/*                                                                      */
/*  Same-Origin Frames                                                  */
/*                                                                      */
/*  - Frame src            utf-8 data uri    utf-8 data uri             */
/*                                           converted to blob url (3)  */
/*                                                                      */
/*  - Binary resources     base64 data uri   null base64 data uri with  */
/*                                           resource reference number  */
/*                                           converted to blob url (3)  */
/*                                                                      */
/*  Cross-Origin Frames                                                 */
/*                                                                      */
/*  - Frame src            utf-8 data uri    utf-8 data uri             */
/*                                                                      */
/*  - Binary resources     base64 data uri   base64 data uri            */
/*                                                                      */
/*  Notes:                                                              */
/*                                                                      */
/*  1. A data uri has a unique opaque origin and so in effect is        */
/*     always cross-origin.                                             */
/*                                                                      */
/*  2. A blob url has the origin of its context and so in effect is     */
/*     always same-origin.                                              */
/*                                                                      */
/*  3. Converting the frame src to a blob url in same-origin frames     */
/*     allows loading of resources with blob urls.                      */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Handling of URL's in HTML Attributes                                */
/*                                                                      */
/*  Element         Attribute     HTML   Content        Handling        */
/*                                                                      */
/*  <a>             href          4 5    -              -               */
/*  <applet>        codebase      4      java           -               */
/*  <area>          href          4 5    -              -               */
/*  <audio>         src             5    audio          data uri   (1)  */
/*  <base>          href          4 5    -              -               */
/*  <blockquote>    cite          4 5    info           -               */
/*  <body>          background    4      image          data uri        */
/*  <button>        formaction      5    -              -               */
/*  <del>           cite          4 5    info           -               */
/*  <embed>         src             5    data           data uri        */
/*  <form>          action        4 5    -              -               */
/*  <frame>         longdesc      4      info           -               */
/*  <frame>         src           4      html           data uri   (2)  */
/*  <head>          profile       4      metadata       -               */
/*  <html>          manifest        5    -              -               */
/*  <iframe>        longdesc      4      info           -               */
/*  <iframe>        src           4 5    html           data uri   (2)  */
/*  <iframe>        srcdoc          5    html           -          (2)  */
/*  <img>           longdesc      4      info           -               */
/*  <img>           src           4 5    image          data uri        */
/*  <img>           srcset          5    images         -          (3)  */
/*  <input>         formaction      5    -              -               */
/*  <input>         src           4 5    image          data uri        */
/*  <ins>           cite          4 5    info           -               */
/*  <link>          href          4 5    css            style      (4)  */
/*  <link>          href          4 5    icon           data uri        */
/*  <object>        archive       4      -              -               */
/*  <object>        classid       4      -              -               */
/*  <object>        codebase      4      -              -               */
/*  <object>        data          4 5    data           data uri        */
/*  <q>             cite          4 5    info           -               */
/*  <script>        src           4 5    javscript      data uri        */
/*  <source>        src             5    audio/video    data uri   (1)  */
/*  <source>        srcset          5    image          -          (3)  */
/*  <track>         src             5    audio/video    data uri        */
/*  <video>         poster          5    image          data uri        */
/*  <video>         src             5    video          data uri   (1)  */
/*                                                                      */
/*  Notes:                                                              */
/*                                                                      */
/*  (1) data uri is created only if the URL in the 'src' attribute      */
/*      is the same as the URL in element.currentSrc of the related     */
/*      <audio> or <video> element.                                     */
/*                                                                      */
/*  (2) data uri is created by processing the frame's HTML sub-tree.    */
/*      URL in 'src' attribute and HTML text in 'srcdoc' attribute      */
/*      determine frame's content, but are not used directly.           */
/*      Or frame content may have been set programmatically.            */
/*                                                                      */
/*  (3) if the URL in element.currentSrc is not the same as the URL     */
/*      in the 'src' attribute, it is assumed to be one of the URL's    */
/*      in the 'srcset' attributes, and the 'src' attribute is set to   */
/*      this URL and the 'srcset' attributes are set to null strings.   */
/*                                                                      */
/*  (4) replace <link> element with <style> element containing the      */
/*      style sheet referred to by the URL in the 'href' attribute.     */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Handling of Binary Data and Characters                              */
/*                                                                      */
/*  1. Files downloaded by XMLHttpRequest GET request are received      */
/*     as a Uint8Array (8-bit unsigned integers) representing:          */
/*     - either binary data (image, font, audio or video)               */
/*     - or encoded characters (style sheets or scripts)                */
/*                                                                      */
/*  2. The Uint8Array is then converted to a Javascript string          */
/*     (16-bit unsigned integers) containing 8-bit unsigned values      */
/*     (a binary string) which is sent to the content script.           */
/*                                                                      */
/*  3. A binary string containing binary data is copied directly        */
/*     into the resourceContent store.                                  */
/*                                                                      */
/*  4. A binary string containing UTF-8 characters is converted to      */
/*     a normal Javascript string (containing UTF-16 characters)        */
/*     before being copied into the resourceContent store.              */
/*                                                                      */
/*  5. A binary string containing non-UTF-8 (ASCII, ANSI, ISO-8859-1)   */
/*     characters is copied directly into the resourceContent store.    */
/*                                                                      */
/*  6. When creating a Base64 data uri, the binary string from the      */
/*     resourceContent store is converted to a Base64 ASCII string      */
/*     using btoa().                                                    */
/*                                                                      */
/*  7. When creating a UTF-8 data uri, the UTF-16 string from the       */
/*     resourceContent store is converted to a UTF-8 %-escaped          */
/*     string using encodeURIComponent(). The following characters      */
/*     are not %-escaped: alphabetic, digits, - _ . ! ~ * ' ( )         */
/*                                                                      */
/*  8. Character encodings are determined as follows:                   */
/*     - UTF-8 Byte Order Mark (BOM) at the start of a text file        */
/*     - charset parameter in the HTTP Content-Type header field        */
/*     - @charset rule at the start of a style sheet                    */
/*     - charset attribute on an element referencing a text file        */
/*     - charset encoding of the parent document or style sheet         */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Maximum Total Size of Resources - Windows 10 Test Results           */
/*                                                                      */
/*  Browser                Maximum      Limit                           */
/*                                                                      */
/*  Chrome 56 (32-bit)      ~691MB      500MB                           */
/*  Chrome 56 (64-bit)      ~338MB      250MB                           */
/*                                                                      */
/*  Chrome 67 (32-bit)      ~691MB      500MB                           */
/*  Chrome 67 (64-bit)      ~338MB      250MB                           */
/*                                                                      */
/*  Firefox 52 (32-bit)     ~184MB      150MB                           */
/*  Firefox 52 (64-bit)     ~185MB      150MB                           */
/*                                                                      */
/*  Firefox 55 (32-bit)     ~537MB      400MB                           */
/*  Firefox 55 (64-bit)    >1536MB     1000MB                           */
/*                                                                      */
/*  Firefox 62 (32-bit)     ~522MB      400MB                           */
/*  Firefox 62 (64-bit)    >1536MB     1000MB                           */
/*                                                                      */
/************************************************************************/

"use strict";

/************************************************************************/

/* Global variables */

var isFirefox;
var ffVersion;

var platformOS;
var platformArch;

var ffPrintEditId = "";
var gcPrintEditId = "";

var buttonAction;
var showSubmenu;
var maxResourceTime;
var allowPassive;
var refererHeader;

var badgeTabId;

var refererKeys = new Array();
var refererValues = new Array();

var originKeys = new Array();
var originValues = new Array();

/************************************************************************/

/* Initialize on browser startup */

chrome.runtime.getPlatformInfo(
function(PlatformInfo)   
{
    platformOS = PlatformInfo.os;
    
    chrome.storage.local.set({ "environment-platformos": platformOS });
    
    platformArch = PlatformInfo.arch;
    
    chrome.storage.local.set({ "environment-platformarch": platformArch });
    
    isFirefox = (navigator.userAgent.indexOf("Firefox") >= 0);
    
    chrome.storage.local.set({ "environment-isfirefox": isFirefox });
    
    if (isFirefox)
    {
        chrome.runtime.getBrowserInfo(
        function(info)
        {
            ffVersion = info.version.substr(0,info.version.indexOf("."));
            
            chrome.storage.local.set({ "environment-ffversion": ffVersion });
            
            ffPrintEditId = "printedit-we@DW-dev";
            
            initialize();
        });
    }
    else
    {
        chrome.management.getSelf(
        function(extensionInfo)
        {
            gcPrintEditId = (extensionInfo.installType == "normal") ? "olnblpmehglpcallpnbgmikjblmkopia" : "dhblkjgdjeojbefdmhibhpgnpicdijbj";
            
            initialize();
        });
    }
});

function initialize()
{
    chrome.storage.local.get(null,
    function(object)
    {
        var context;
        
        /* Initialize or migrate options */
        
        /* General options */
        
        if (!("options-buttonaction" in object)) object["options-buttonaction"] =
            ("options-savebuttonaction" in object) ? object["options-savebuttonaction"] : 2;  /* Version 2.0-2.1 */
        
        if (!("options-showsubmenu" in object)) object["options-showsubmenu"] =
            ("options-showmenuitem" in object) ? object["options-showmenuitem"] : true;  /* Version 3.0-5.0 */
        
        if (!("options-showwarning" in object)) object["options-showwarning"] = true;
        
        if (!("options-showurllist" in object)) object["options-showurllist"] = false;
        
        if (!("options-promptcomments" in object)) object["options-promptcomments"] = false;
        
        if (!("options-usepageloader" in object)) object["options-usepageloader"] = true;
        
        if (!("options-retaincrossframes" in object)) object["options-retaincrossframes"] = true;
        
        if (!("options-removeunsavedurls" in object)) object["options-removeunsavedurls"] = true;
        
        if (!("options-includeinfobar" in object)) object["options-includeinfobar"] =
            ("options-includenotification" in object) ? object["options-includenotification"] : false;  /* Version 7.4 */
        
        if (!("options-includesummary" in object)) object["options-includesummary"] = false;
        
        if (!("options-formathtml" in object)) object["options-formathtml"] = false;
        
        if (!("options-savedfilename" in object))
        {
            object["options-savedfilename"] = "%TITLE%";
            
            if ("options-prefixfilename" in object && "options-prefixtext" in object && object["options-prefixfilename"])
                object["options-savedfilename"] = object["options-prefixtext"].replace(/%DOMAIN%/g,"%HOST%") + object["options-savedfilename"];
            
            if ("options-suffixfilename" in object && "options-suffixtext" in object && object["options-suffixfilename"])
                object["options-savedfilename"] = object["options-savedfilename"] + object["options-suffixtext"].replace(/%DOMAIN%/g,"%HOST%");
        }
        
        if (!("options-replacespaces" in object)) object["options-replacespaces"] = false;
        
        if (!("options-replacechar" in object)) object["options-replacechar"] = "-";
        
        /* Saved Items options */
        
        if (!("options-savehtmlimagesall" in object)) object["options-savehtmlimagesall"] =
            ("options-saveallhtmlimages" in object) ? object["options-saveallhtmlimages"] : false;  /* Version 2.0-3.0 */
        
        if (!("options-savehtmlaudiovideo" in object)) object["options-savehtmlaudiovideo"] = false;
        
        if (!("options-savehtmlobjectembed" in object)) object["options-savehtmlobjectembed"] = false;
        
        if (!("options-savecssimagesall" in object)) object["options-savecssimagesall"] =
            ("options-saveallcssimages" in object) ? object["options-saveallcssimages"] : false;  /* Version 2.0-3.0 */
        
        if (!("options-savecssfontswoff" in object)) object["options-savecssfontswoff"] =
            ("options-saveallcustomfonts" in object) ? object["options-saveallcustomfonts"] : false;  /* Version 2.0-3.0 */
        
        if (!("options-savescripts" in object)) object["options-savescripts"] =
            ("options-saveallscripts" in object) ? object["options-saveallscripts"] : false;  /* Version 2.0-3.0 */
        
        /* Advanced options */
        
        if (!("options-maxframedepth" in object)) object["options-maxframedepth"] =
            ("options-saveframedepth" in object) ? object["options-saveframedepth"] : 5;  /* Version 2.0-2.1 */
        
        if (!("options-maxresourcesize" in object)) object["options-maxresourcesize"] = 50;
        
        if (!("options-maxresourcetime" in object)) object["options-maxresourcetime"] =
            ("options-resourcetimeout" in object) ? object["options-resourcetimeout"] : 10;  /* Version 9.0-9.1 */
        
        if (!("options-allowpassive" in object)) object["options-allowpassive"] = false;
        
        if (!("options-refererheader" in object)) object["options-refererheader"] = 0;
        
        if (!("options-maxframedepth-9.0" in object))
        {
            object["options-maxframedepth"] = 5;
            object["options-maxframedepth-9.0"] = true;
        }
        
        /* Update stored options */
        
        chrome.storage.local.set(object);
        
        /* Initialize local options */
        
        buttonAction = object["options-buttonaction"];
        
        showSubmenu = object["options-showsubmenu"];
        
        maxResourceTime = object["options-maxresourcetime"];
        
        allowPassive = object["options-allowpassive"];
        
        refererHeader = object["options-refererheader"];
        
        /* Add context menu items */
        
        context = showSubmenu ? "all" : "browser_action";
        
        chrome.contextMenus.create({ id: "basicitems", title: "Save Basic Items", contexts: [ context ], enabled: true });
        chrome.contextMenus.create({ id: "chosenitems", title: "Save Chosen Items", contexts: [ context ], enabled: true });
        chrome.contextMenus.create({ id: "standarditems", title: "Save Standard Items", contexts: [ context ], enabled: true });
        chrome.contextMenus.create({ id: "separator", type: "separator", contexts: [ context ], enabled: true });
        chrome.contextMenus.create({ id: "viewpageinfo", title: "View Saved Page Info", contexts: [ context ], enabled: true });
        chrome.contextMenus.create({ id: "removepageloader", title: "Remove Page Loader", contexts: [ context ], enabled: true });
        chrome.contextMenus.create({ id: "extractmedia", title: "Extract Image/Audio/Video", contexts: [ "image", "audio", "video" ], enabled: true });
        
        /* Set button and menu states */
        
        chrome.tabs.query({ lastFocusedWindow: true, active: true },
        function(tabs)
        {
            setButtonAndMenuStates(tabs[0].id,tabs[0].url);
        });
        
        /* Add listeners */
        
        addListeners();
    });
}

/************************************************************************/

/* Add listeners */

function addListeners()
{
    /* Storage changed listener */
    
    chrome.storage.onChanged.addListener(
    function(changes,areaName)
    {
        chrome.storage.local.get(null,
        function(object)
        {
            var context;
            
            buttonAction = object["options-buttonaction"];
            
            showSubmenu = object["options-showsubmenu"];
            
            maxResourceTime = object["options-maxresourcetime"];
            
            allowPassive = object["options-allowpassive"];
            
            refererHeader = object["options-refererheader"];
            
            if ("options-showsubmenu" in changes)
            {
                context = showSubmenu ? "all" : "browser_action";
                
                chrome.contextMenus.update("basicitems",{ contexts: [ context ] });
                chrome.contextMenus.update("chosenitems",{ contexts: [ context ] });
                chrome.contextMenus.update("standarditems",{ contexts: [ context ] });
                chrome.contextMenus.update("separator", { contexts: [ context ] });
                chrome.contextMenus.update("viewpageinfo", { contexts: [ context ] });
                chrome.contextMenus.update("removepageloader", { contexts: [ context ] });
                chrome.contextMenus.update("extractmedia", { contexts: [ "image", "audio", "video" ] });
                
                chrome.tabs.query({ lastFocusedWindow: true, active: true },
                function(tabs)
                {
                    setButtonAndMenuStates(tabs[0].id,tabs[0].url);
                });
            }
        });
    });
    
    /* Browser action listener */
    
    chrome.browserAction.onClicked.addListener(
    function(tab)
    {
        initiateAction(tab,buttonAction,null,false,false,false);
    });
    
    /* Keyboard command listener */
    
    chrome.commands.onCommand.addListener(
    function(command)
    {
        chrome.tabs.query({ lastFocusedWindow: true, active: true },
        function(tabs)
        {
            if (command == "savepage")
            {
                initiateAction(tabs[0],buttonAction,null,false,false,false);
            }
        });
    });
    
    /* Context menu listener */
    
    chrome.contextMenus.onClicked.addListener(
    function(info,tab)
    {
        if (info.menuItemId == "basicitems") initiateAction(tab,0,null,false,false,false);
        else if (info.menuItemId == "chosenitems") initiateAction(tab,1,null,false,false,false);
        else if (info.menuItemId == "standarditems") initiateAction(tab,2,null,false,false,false);
        else if (info.menuItemId == "viewpageinfo") initiateAction(tab,3,null,false,false,false);
        else if (info.menuItemId == "removepageloader") initiateAction(tab,4,null,false,false,false);
        else if (info.menuItemId == "extractmedia") initiateAction(tab,5,info.srcUrl,false,false,false);
    });
    
    /* Tab event listeners */
    
    chrome.tabs.onActivated.addListener(  /* tab selected */
    function(activeInfo)
    {
        chrome.tabs.get(activeInfo.tabId,
        function(tab)
        {
            if (chrome.runtime.lastError == null)  /* sometimes tab does not exist */
            {
                setButtonAndMenuStates(activeInfo.tabId,tab.url);
            }
        });
    });
    
    chrome.tabs.onUpdated.addListener(  /* URL updated */
    function(tabId,changeInfo,tab)
    {
        setButtonAndMenuStates(tabId,tab.url);
    });
    
    /* Web navigation listeners */
    
    chrome.webNavigation.onCompleted.addListener(  /* page loaded or (Firefox) extracted resource downloaded */
    function(details)
    {
        if (details.frameId == 0)
        {
            /* If triggered by Extract Image/Audio/Video, details.url */
            /* will contain resource URL, so need to get page URL */ 
            
            chrome.tabs.get(details.tabId,
            function(tab)
            {
                setButtonAndMenuStates(details.tabId,tab.url);
                
                setSaveBadge("","#000000");
            });
        }
    });
    
    /* Web request listeners */
    
    chrome.webRequest.onBeforeSendHeaders.addListener(
    function(details)
    {
        var i,j;
        
        for (i = 0; i < details.requestHeaders.length; i++)
        {
            if (details.requestHeaders[i].name == "savepage-referer")
            {
                for (j = 0; j < refererKeys.length; j++)
                {
                    if (details.requestHeaders[i].value == refererKeys[j])
                    {
                        details.requestHeaders.splice(i,1,{ name: "Referer", value: refererValues[j] });
                    }
                }
            }
            
            if (details.requestHeaders[i].name == "savepage-origin")
            {
                for (j = 0; j < originKeys.length; j++)
                {
                    if (details.requestHeaders[i].value == originKeys[j])
                    {
                        details.requestHeaders.splice(i,1,{ name: "Origin", value: originValues[j] });
                    }
                }
            }
        }
        
        return { requestHeaders: details.requestHeaders };
    },
    { urls: ["<all_urls>"], types: ["xmlhttprequest"] },["blocking","requestHeaders"]);
    
    /* Message received listener */
    
    chrome.runtime.onMessage.addListener(
    function(message,sender,sendResponse)
    {
        var safeContent,mixedContent,refererURL,refererKey,originKey,receiverId;
        var xhr = new Object();
        
        switch (message.type)
        {
            /* Messages from content script */
            
            case "requestCrossFrames":
                
                chrome.tabs.sendMessage(sender.tab.id,{ type: "requestCrossFrames" },checkError);
                
                break;
                
            case "replyCrossFrame":
                
                chrome.tabs.sendMessage(sender.tab.id,{ type: "replyCrossFrame", name: message.name, url: message.url, html: message.html, fonts: message.fonts },checkError);
                
                break;
                
            case "loadResource":
                
                /* XMLHttpRequest must not be sent if http: resource in https: page or https: referer */
                /* unless passive mixed content allowed by user option */
                
                safeContent = (message.location.substr(0,6) == "https:" ||
                               (message.location.substr(0,5) == "http:" && message.referer.substr(0,5) == "http:" && message.pagescheme == "http:"));
                
                mixedContent = (message.location.substr(0,5) == "http:" && (message.referer.substr(0,6) == "https:" || message.pagescheme == "https:"));
                
                if (safeContent || (mixedContent && message.passive && allowPassive))
                { 
                    /* Load same-origin resource - or cross-origin with or without CORS - and add Referer Header */
                    
                    try
                    {
                        xhr = new XMLHttpRequest();
                        
                        xhr.open("GET",message.location,true);
                        
                        refererURL = new URL(message.referer);
                        
                        /* Referer Header must not be set if http: resource in https: page or https: referer */
                        /* Referer Header must not be set if file: or data: resource */
                        /* Referer Header only set if allowed by user option */
                        /* Referer Header has restricted referer URL */
                        
                        if (safeContent && message.referer.substr(0,5) != "file:" && message.referer.substr(0,5) != "data:")
                        {
                            if (refererHeader > 0)
                            {                                
                                refererKey = Math.trunc(Math.random()*1000000000);
                                
                                refererKeys.push(refererKey);
                                
                                if (refererHeader == 1) refererValues.push(refererURL.origin);  /* referer URL restricted to origin */
                                else if (refererHeader == 2)
                                {
                                    if (sender.tab.incognito) refererValues.push(refererURL.origin);  /* referer URL restricted to origin */
                                    else refererValues.push(refererURL.origin + refererURL.pathname);  /* referer URL restricted to origin and path */
                                }
                                
                                xhr.setRequestHeader("savepage-referer",refererKey);
                                
                                xhr._refererkey = refererKey;
                            }
                        }
                        
                        /* Origin Header must be set for CORS to operate */
                        
                        if (message.usecors)
                        {
                            originKey = Math.trunc(Math.random()*1000000000);
                            
                            originKeys.push(originKey);
                            
                            originValues.push(refererURL.origin);
                            
                            xhr.setRequestHeader("savepage-origin",originKey);
                            
                            xhr._originkey = originKey;
                        }
                        
                        xhr.setRequestHeader("Cache-Control","no-store");
                        
                        xhr.responseType = "arraybuffer";
                        xhr.timeout = maxResourceTime*1000;
                        xhr.onload = onloadResource;
                        xhr.onerror = onerrorResource;
                        xhr.ontimeout = ontimeoutResource;
                        
                        xhr._tabId = sender.tab.id;
                        xhr._index = message.index;
                        
                        xhr.send();  /* throws exception if url is invalid */
                    }
                    catch(e)
                    {
                        if (xhr._refererkey) removeRefererKey(xhr._refererkey);
                        if (xhr._originkey) removeOriginKey(xhr._originkey);
                        
                        chrome.tabs.sendMessage(sender.tab.id,{ type: "loadFailure", index: message.index, reason: "send" },checkError);
                    }
                }
                else chrome.tabs.sendMessage(sender.tab.id,{ type: "loadFailure", index: message.index, reason: "mixed" },checkError);
                
                function onloadResource()
                {
                    var i,binaryString,contentType,allowOrigin;
                    var byteArray = new Uint8Array(this.response);
                    
                    if (this._refererkey) removeRefererKey(this._refererkey);
                    if (this._originkey) removeOriginKey(this._originkey);
                    
                    if (this.status == 200)
                    {
                        binaryString = "";
                        for (i = 0; i < byteArray.byteLength; i++) binaryString += String.fromCharCode(byteArray[i]);
                        
                        contentType = this.getResponseHeader("Content-Type");
                        if (contentType == null) contentType = "";
                        
                        allowOrigin = this.getResponseHeader("Access-Control-Allow-Origin");
                        if (allowOrigin == null) allowOrigin = "";
                        
                        chrome.tabs.sendMessage(this._tabId,{ type: "loadSuccess", index: this._index, 
                                                              content: binaryString, contenttype: contentType, alloworigin: allowOrigin },checkError);
                    }
                    else chrome.tabs.sendMessage(this._tabId,{ type: "loadFailure", index: this._index, reason: "load:" + this.status },checkError);
                }
                
                function onerrorResource()
                {
                    if (this._refererkey) removeRefererKey(this._refererkey);
                    if (this._originkey) removeOriginKey(this._originkey);
                    
                    chrome.tabs.sendMessage(this._tabId,{ type: "loadFailure", index: this._index, reason: "network" },checkError);
                }
                
                function ontimeoutResource()
                {
                    if (this._refererkey) removeRefererKey(this._refererkey);
                    if (this._originkey) removeOriginKey(this._originkey);
                    
                    chrome.tabs.sendMessage(this._tabId,{ type: "loadFailure", index: this._index, reason: "timeout" },checkError);
                }
                
                function removeRefererKey(refererkey)
                {
                    var j;
                    
                    for (j = 0; j < refererKeys.length; j++)
                    {
                        if (refererKeys[j] == refererkey)
                        {
                            refererKeys.splice(j,1);
                            refererValues.splice(j,1);
                        }
                    }
                }
                
                function removeOriginKey(originkey)
                {
                    var j;
                    
                    for (j = 0; j < originKeys.length; j++)
                    {
                        if (originKeys[j] == originkey)
                        {
                            originKeys.splice(j,1);
                            originValues.splice(j,1);
                        }
                    }
                }
                
                break;
                
            case "setSaveBadge":
                
                setSaveBadge(message.text,message.color);
                
                break;
                
            case "saveDone":
                
                if (!isFirefox) receiverId = gcPrintEditId;
                else if (ffVersion >= 54) receiverId = ffPrintEditId;
                
                chrome.runtime.sendMessage(receiverId,{ type: "externalSaveDone", success: message.success },checkError);
                
                break;
        }
    });
    
    /* External message received listener */
    
    if (!isFirefox || ffVersion >= 54)
    {
        chrome.runtime.onMessageExternal.addListener(
        function(message,sender,sendResponse)
        {
            switch (message.type)
            {
                /* Messages from another add-on */
                
                case "externalSaveStart":
                    
                    if (sender.id == ffPrintEditId || sender.id == gcPrintEditId)
                    {
                        sendResponse({ });
                        
                        chrome.tabs.query({ lastFocusedWindow: true, active: true },
                        function(tabs)
                        {
                            initiateAction(tabs[0],message.action,null,true,message.purgedeleted,message.purgehidden,message.swapdevices);
                        });
                    }
                    
                    break;
                    
                case "externalSaveCheck":
                    
                    if (sender.id == ffPrintEditId || sender.id == gcPrintEditId)
                    {
                        sendResponse({ });
                    }
                    
                    break;
            }
        });
    }
}

/************************************************************************/

/* Initiate action function */

function initiateAction(tab,menuaction,srcurl,externalsave,purgedeleted,purgehidden,swapdevices)
{
    if (specialPage(tab.url))  /* special page - no operations allowed */
    {
        alertNotify("Cannot be used with these special pages:\n" +
                    "about:, moz-extension:,\n" +
                    "https://addons.mozilla.org,\n" +
                    "chrome:, chrome-extension:,\n" +
                    "https://chrome.google.com/webstore.");
    }
    else if (tab.url.substr(0,5) != "file:" && menuaction >= 3)  /* probably not saved page - view saved page info and extract media operations not allowed */
    {
        alertNotify("Cannot view saved page information or extract media files for unsaved pages.");
    }
    else  /* normal page - save operations allowed, saved page - all operations allowed */
    {
        badgeTabId = tab.id;
        
        chrome.tabs.sendMessage(tab.id,{ type: "performAction", menuaction: menuaction, srcurl: srcurl,
                                         externalsave: externalsave, purgedeleted: purgedeleted, purgehidden: purgehidden, swapdevices: swapdevices },
        function(response)
        {
            if (chrome.runtime.lastError != null || typeof response == "undefined")  /* no response received - content script not loaded in active tab */
            {
                chrome.tabs.executeScript(tab.id,{ file: "content.js" },
                function()
                {
                    window.setTimeout(  /* allow time for content script to be initialized */
                    function()
                    {
                        chrome.tabs.sendMessage(tab.id,{ type: "performAction", menuaction: menuaction, srcurl: srcurl,
                                                         externalsave: externalsave, purgedeleted: purgedeleted, purgehidden: purgehidden, swapdevices: swapdevices },
                        function(response)
                        {
                            if (chrome.runtime.lastError != null || typeof response == "undefined")  /* no response received - content script cannot be loaded in active tab*/
                            {
                                alertNotify("Cannot be used with this page.");
                            }
                            else
                            {
                                chrome.tabs.executeScript(tab.id,{ file: "content-frame.js", allFrames: true });
                            }
                        });
                    },50);
                });
            }
        });
    }
}

/************************************************************************/

/* Special page function */

function specialPage(url)
{
    return (url.substr(0,6) == "about:" || url.substr(0,14) == "moz-extension:" || url.substr(0,26) == "https://addons.mozilla.org" ||
            url.substr(0,7) == "chrome:" || url.substr(0,17) == "chrome-extension:" || url.substr(0,34) == "https://chrome.google.com/webstore");
}

/************************************************************************/

/* Set button and menu states function */

function setButtonAndMenuStates(tabId,url)
{
    if (specialPage(url))  /* special page - disable all operations */
    {
        chrome.browserAction.disable(tabId);
        
        if (isFirefox && ffVersion <= 54) chrome.browserAction.setIcon({ tabId: tabId, path: "icon16-disabled.png"});  /* Firefox 54- - icon not changed */
        
        chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE - cannot be used with this page" });
        
        chrome.contextMenus.update("basicitems",{ enabled: false });
        chrome.contextMenus.update("chosenitems",{ enabled: false });
        chrome.contextMenus.update("standarditems",{ enabled: false });
        chrome.contextMenus.update("separator", { enabled: true });
        chrome.contextMenus.update("viewpageinfo", { enabled: false });
        chrome.contextMenus.update("removepageloader", { enabled: false });
        if (showSubmenu) chrome.contextMenus.update("extractmedia", { contexts: [ "image", "audio", "video" ], enabled: false });
        else chrome.contextMenus.update("extractmedia", { contexts: [ "page_action" ], enabled: false });  /* never shown because there is no page action */
    }
    else if (url.substr(0,5) == "file:")  /* probably saved page - enable all operations */
    {
        chrome.browserAction.enable(tabId);
        
        if (isFirefox && ffVersion <= 54) chrome.browserAction.setIcon({ tabId: tabId, path: "icon16.png"});  /* Firefox 54- - icon not changed */
        
        chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE" });
        
        chrome.contextMenus.update("basicitems",{ enabled: true });
        chrome.contextMenus.update("chosenitems",{ enabled: true });
        chrome.contextMenus.update("standarditems",{ enabled: true });
        chrome.contextMenus.update("separator", { enabled: true });
        chrome.contextMenus.update("viewpageinfo", { enabled: true });
        chrome.contextMenus.update("removepageloader", { enabled: true });
        chrome.contextMenus.update("extractmedia", { contexts: [ "image", "audio", "video" ], enabled: true });
    }
    else  /* normal page - enable save operations */
    {
        chrome.browserAction.enable(tabId);
        
        if (isFirefox && ffVersion <= 54) chrome.browserAction.setIcon({ tabId: tabId, path: "icon16.png"});  /* Firefox 54- - icon not changed */
        
        chrome.browserAction.setTitle({ tabId: tabId, title: "Save Page WE" });
        
        chrome.contextMenus.update("basicitems",{ enabled: true });
        chrome.contextMenus.update("chosenitems",{ enabled: true });
        chrome.contextMenus.update("standarditems",{ enabled: true });
        chrome.contextMenus.update("separator", { enabled: true });
        chrome.contextMenus.update("viewpageinfo", { enabled: false });
        chrome.contextMenus.update("removepageloader", { enabled: false });
        if (showSubmenu) chrome.contextMenus.update("extractmedia", { contexts: [ "image", "audio", "video" ], enabled: false });
        else chrome.contextMenus.update("extractmedia", { contexts: [ "page_action" ], enabled: false });  /* never shown because there is no page action */
    }
}

/************************************************************************/

/* Set save badge function */

function setSaveBadge(text,color)
{
    chrome.browserAction.setBadgeText({ tabId: badgeTabId, text: text });
    chrome.browserAction.setBadgeBackgroundColor({ tabId: badgeTabId, color: color });
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
