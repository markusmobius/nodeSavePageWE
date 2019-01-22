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

"use strict";

/************************************************************************/

/* Global variables */

var maxTotalSize = 1000;  /* MB */

var usePageLoader = true;
var retainCrossFrames = true;
var removeUnsavedURLs = true;
var includeInfoBar = false;
var includeSummary = false;
var formatHTML = false;
var replaceSpaces = true;
var replaceChar = "_";
var saveHTMLAudioVideo = true;
var saveHTMLObjectEmbed = true;
var saveHTMLImagesAll = true;
var saveCSSImagesAll, saveCSSFontsWoff, saveScripts = true;
var maxFrameDepth = 5;
var maxResourceSize = 50;
var maxResourceTime = 10;
var allowPassive = false;
var refererHeader = false;
var purgeDeleted=false;
var menuAction = 2;
var swapDevices = false;
var purgeHidden = false;

var savedPage=false;  /* page was saved by Save Page WE */
var savedPageLoader;  /* page contains page loader script */

var passNumber;
var iconFound;

var crossFrameName = new Array();
var crossFrameURL = new Array();
var crossFrameHTML = new Array();
var crossFrameFonts = new Array();

var resourceCount;

var resourceLocation = new Array();
var resourceReferer = new Array();
var resourceMimeType = new Array();
var resourceCharSet = new Array();
var resourcePassive = new Array();
var resourceContent = new Array();
var resourceStatus = new Array();
var resourceReason = new Array();
var resourceRemembered = new Array();
var resourceReplaced = new Array();

var htmlStrings = new Array();
var saveStrings = new Array();

var timeStart = new Array();
var timeFinish = new Array();

/* Initialize resources */

crossFrameName.length = 0;
crossFrameURL.length = 0;
crossFrameHTML.length = 0;
crossFrameFonts.length = 0;

resourceLocation.length = 0;
resourceReferer.length = 0;
resourceMimeType.length = 0;
resourceCharSet.length = 0;
resourcePassive.length = 0;
resourceContent.length = 0;
resourceStatus.length = 0;
resourceReason.length = 0;
resourceRemembered.length = 0;
resourceReplaced.length = 0;

var pageLoaderText = "";

htmlStrings.length = 0;

htmlStrings[0] = "\uFEFF";  /* UTF-8 Byte Order Mark (BOM) - 0xEF 0xBB 0xBF */
var htmlOutput = "";

/************************************************************************/


/* Pre Pass - to identify and name cross-origin frames */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function identifyCrossFrames()
{
    passNumber = 0;
    
    timeStart[0] = performance.now();
    
    nameCrossFrames(0,window,document.documentElement);
    
    timeFinish[0] = performance.now();
    
    await sleep(200);
    await gatherStyleSheets();

    //return resources
    var toPuppeteer = [];
    for (var i = 0; i < resourceLocation.length; i++)
    {
        toPuppeteer.push(
            {
                "url": resourceLocation[i],
                "referer": resourceReferer[i]
            });
    }
    return toPuppeteer;
}


function nameCrossFrames(depth,frame,element)
{
    var i;
    
    /* Handle nested frames and child elements */
    
    if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
    {
        if (depth < maxFrameDepth)
        {
            try
            {
                if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before naming */
                {
                    nameCrossFrames(depth+1,element.contentWindow,element.contentDocument.documentElement);
                }
            }
            catch (e)  /* attempting cross-domain web page access */
            {
                if (retainCrossFrames)
                {
                    if (!element.name) element.setAttribute("name","savepage-frame-" + Math.trunc(Math.random()*1000000000));
                    
                    // console.log("Main  - Cross - " + depth + " - " + (element.name + "                         ").substr(0,25) + " - " +
                                 // (element.src + "                                                            ").replace(/\:/g,"").substr(0,80));  /*???*/
                }
            }
        }
    }
    else
    {
        for (i = 0; i < element.children.length; i++)
            if (element.children[i] != null)  /* in case web page not fully loaded before finding */
                nameCrossFrames(depth,frame,element.children[i]);
    }
}

/************************************************************************/

/* First Pass - to find external style sheets and load into arrays */

async function gatherStyleSheets()
{
    passNumber = 1;
    
    //chrome.runtime.sendMessage({ type: "setSaveBadge", text: "SAVE", color: "#E00000" });
    
    timeStart[1] = performance.now();
    
    findStyleSheets(0,window,document.documentElement,false);
    
    timeFinish[1] = performance.now();

    loadResources();
}

function findStyleSheets(depth,frame,element,crossorigin)
{
    var i,baseuri,charset,csstext,regex,parser,framedoc;
    var matches = new Array();
    
    /* External style sheet imported in <style> element */
    
    if (element.localName == "style")
    {
        if (!element.disabled)
        {
            csstext = element.textContent;
            
            baseuri = element.ownerDocument.baseURI;
            
            charset = element.ownerDocument.characterSet;
            
            regex = /@import\s*(?:url\(\s*)?((?:"[^"]+")|(?:'[^']+')|(?:[^\s);]+))(?:\s*\))?\s*;/gi;  /* @import url() */
            
            while ((matches = regex.exec(csstext)) != null)
            {
                matches[1] = removeQuotes(matches[1]);
                
                if (!isSchemeDataOrMozExtension(matches[1]))  /* exclude existing data uri or moz-extension url */
                {
                    rememberURL(matches[1],baseuri,"text/css",charset,false);
                }
            }
        }
    }
    
    /* External style sheet referenced in <link> element */
    
    else if (element.localName == "link")
    {
        if (element.rel.toLowerCase() == "stylesheet" && element.getAttribute("href") != "" && element.href != "")  /* href attribute and property may be different */
        {
            if (!element.disabled)
            {
                if (!isSchemeDataOrMozExtension(element.href))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    if (element.charset != "") charset = element.charset;
                    else charset = element.ownerDocument.characterSet;
                    
                    rememberURL(element.href,baseuri,"text/css",charset,false);
                }
            }
        }
    }
    
    /* Handle nested frames and child elements */
    
    if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
    {
        if (depth < maxFrameDepth)
        {
            try
            {
                if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before finding */
                {
                    findStyleSheets(depth+1,element.contentWindow,element.contentDocument.documentElement,crossorigin);
                }
            }
            catch (e)  /* attempting cross-domain web page access */
            {
                if (retainCrossFrames)
                {
                    for (i = 0; i < crossFrameName.length; i++)
                    {
                        if (crossFrameName[i] == element.name) break;
                    }
                    
                    if (i != crossFrameName.length)
                    {
                        parser = new DOMParser();
                        framedoc = parser.parseFromString(crossFrameHTML[i],"text/html");
                        
                        findStyleSheets(depth+1,window,framedoc.documentElement,true);
                    }
                }
            }
        }
    }
    else
    {
        for (i = 0; i < element.children.length; i++)
            if (element.children[i] != null)  /* in case web page not fully loaded before finding */
                findStyleSheets(depth,frame,element.children[i],crossorigin);
    }
}

/************************************************************************/

/* Second Pass - to find other external resources and load into arrays */

function gatherOtherResources()
{
    var loadedfonts = new Array();
    
    passNumber = 2;
    
    iconFound = false;
    
    //chrome.runtime.sendMessage({ type: "setSaveBadge", text: "SAVE", color: "#A000D0" });
    
    timeStart[2] = performance.now();
    
    document.fonts.forEach(  /* CSS Font Loading Module */
    function(font)
    {
        if (font.status == "loaded")  /* font is being used in this document */
        {
            loadedfonts.push({ family: font.family, weight: font.weight, style: font.style, stretch: font.stretch });
        }
    });
    
    findOtherResources(0,window,document.documentElement,false,false,loadedfonts);
    
    timeFinish[2] = performance.now();
    
    loadResources();
}

function findOtherResources(depth,frame,element,crossorigin,nosource,loadedfonts)
{
    var i,j,displayed,style,csstext,baseuri,charset,currentsrc,passive,regex,location,parser,framedoc;
    var matches = new Array();
    
    if (false)
    {
    }
    else if ((style = frame.getComputedStyle(element)) == null) displayed = true;
    else
    {
        displayed = (style.getPropertyValue("display") != "none");
        
        /* External images referenced in any element's computed style */
        
        if ((menuAction == 2 || (menuAction == 1 && !saveCSSImagesAll) || menuAction == 0) && displayed)
        {
            csstext = "";
            
            csstext += style.getPropertyValue("background-image") + " ";
            csstext += style.getPropertyValue("border-image-source") + " ";
            csstext += style.getPropertyValue("list-style-image") + " ";
            csstext += style.getPropertyValue("cursor") + " ";
            csstext += style.getPropertyValue("filter") + " ";
            csstext += style.getPropertyValue("clip-path") + " ";
            csstext += style.getPropertyValue("mask") + " ";
            
            style = frame.getComputedStyle(element,"::before");
            csstext += style.getPropertyValue("background-image") + " ";
            csstext += style.getPropertyValue("border-image-source") + " ";
            csstext += style.getPropertyValue("list-style-image") + " ";
            csstext += style.getPropertyValue("cursor") + " ";
            csstext += style.getPropertyValue("content") + " ";
            csstext += style.getPropertyValue("filter") + " ";
            csstext += style.getPropertyValue("clip-path") + " ";
            csstext += style.getPropertyValue("mask") + " ";
            
            style = frame.getComputedStyle(element,"::after");
            csstext += style.getPropertyValue("background-image") + " ";
            csstext += style.getPropertyValue("border-image-source") + " ";
            csstext += style.getPropertyValue("list-style-image") + " ";
            csstext += style.getPropertyValue("cursor") + " ";
            csstext += style.getPropertyValue("content") + " ";
            csstext += style.getPropertyValue("filter") + " ";
            csstext += style.getPropertyValue("clip-path") + " ";
            csstext += style.getPropertyValue("mask") + " ";
            
            style = frame.getComputedStyle(element,"::first-letter");
            csstext += style.getPropertyValue("background-image") + " ";
            csstext += style.getPropertyValue("border-image-source") + " ";
            
            style = frame.getComputedStyle(element,"::first-line");
            csstext += style.getPropertyValue("background-image") + " ";
            
            baseuri = element.ownerDocument.baseURI;
            
            regex = /url\(\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s)]+))\s*\)/gi;  /* image url() */
            
            while ((matches = regex.exec(csstext)) != null)
            {
                matches[1] = removeQuotes(matches[1]);
                
                if (!isSchemeDataOrMozExtension(matches[1]))  /* exclude existing data uri or moz-extension url */
                {
                    rememberURL(matches[1],baseuri,"image/png","",false);
                }
            }
        }
    }
    
    /* External images referenced in any element's style attribute */
    
    if (element.hasAttribute("style"))
    {
        if ((menuAction == 1 && saveCSSImagesAll))
        {
            csstext = element.getAttribute("style");
            
            baseuri = element.ownerDocument.baseURI;
            
            regex = /url\(\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s)]+))\s*\)/gi;  /* image url() */
            
            while ((matches = regex.exec(csstext)) != null)
            {
                matches[1] = removeQuotes(matches[1]);
                
                if (!isSchemeDataOrMozExtension(matches[1]))  /* exclude existing data uri or moz-extension url */
                {
                    rememberURL(matches[1],baseuri,"image/png","",false);
                }
            }
        }
    }
    
    /* External script referenced in <script> element */
    
    if (element.localName == "script")
    {
        if (element.src != "")
        {
            if ((menuAction == 1 && saveScripts) && !crossorigin && !nosource)
            {
                if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    if (element.charset != "") charset = element.charset;
                    else charset = element.ownerDocument.characterSet;
                    
                    rememberURL(element.src,baseuri,"application/javascript",charset,false);
                }
            }
        }
    }
    
    /* External images or fonts referenced in <style> element */
    
    else if (element.localName == "style")
    {
        if (!element.disabled)
        {
            csstext = element.textContent;
            
            baseuri = element.ownerDocument.baseURI;
            
            findCSSURLsInStyleSheet(csstext,baseuri,crossorigin,loadedfonts);
        }
    }
    
    /* External images or fonts referenced in <link> element */
    /* External icon referenced in <link> element */
    
    else if (element.localName == "link")
    {
        if (element.rel.toLowerCase() == "stylesheet" && element.getAttribute("href") != "" && element.href != "")  /* href attribute and property may be different */
        {
            if (!element.disabled)
            {
                if (!isSchemeDataOrMozExtension(element.href))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    if (baseuri != null)
                    {
                        location = resolveURL(element.href,baseuri);
                        
                        if (location != null)
                        {
                            for (i = 0; i < resourceLocation.length; i++)
                                if (resourceLocation[i] == location && resourceStatus[i] == "success") break;
                            
                            if (i < resourceLocation.length)  /* style sheet found */
                            {
                                csstext = resourceContent[i];
                                
                                baseuri = element.href;
                                
                                findCSSURLsInStyleSheet(csstext,baseuri,crossorigin,loadedfonts);
                            }
                        }
                    }
                }
            }
        }
        else if ((element.rel.toLowerCase() == "icon" || element.rel.toLowerCase() == "shortcut icon") && element.href != "")
        {
            iconFound = true;
            
            baseuri = element.ownerDocument.baseURI;
            
            rememberURL(element.href,baseuri,"image/vnd.microsoft.icon","",false);
        }
    }
    
    /* External image referenced in <body> element */
    
    else if (element.localName == "body")
    {
        if (element.background != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLImagesAll) ||
                ((menuAction == 1 && !saveHTMLImagesAll) || menuAction == 0) && displayed)
            {
                if (!isSchemeDataOrMozExtension(element.background))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    rememberURL(element.background,baseuri,"image/png","",false);
                }
            }
        }
    }
    
    /* External image referenced in <img> element - can be inside <picture> element */
    
    else if (element.localName == "img")
    {
        /* currentSrc is set from src or srcset attributes on this <img> element */
        /* or from srcset attribute on <source> element inside <picture> element */
        
        /* Firefox - workaround because currentSrc may be null string in cross-origin frames */
        
        currentsrc = (element.currentSrc == "") ? element.src : element.currentSrc;
        
        if (currentsrc != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLImagesAll) ||
                ((menuAction == 1 && !saveHTMLImagesAll) || menuAction == 0) && displayed)
            {
                if (!isSchemeDataOrMozExtension(currentsrc))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    passive = !(element.parentElement.localName == "picture" || element.hasAttribute("srcset") || element.hasAttribute("crossorigin"));
                    
                    rememberURL(currentsrc,baseuri,"image/png","",passive);
                }
            }
        }
    }
    
    /* External image referenced in <input> element */
    
    else if (element.localName == "input")
    {
        if (element.type.toLowerCase() == "image" && element.src != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLImagesAll) ||
                ((menuAction == 1 && !saveHTMLImagesAll) || menuAction == 0) && displayed)
            {
                if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    rememberURL(element.src,baseuri,"image/png","",false);
                }
            }
        }
    }
    
    /* External audio referenced in <audio> element */
    
    else if (element.localName == "audio")
    {
        if (element.src != "")
        {
            if (element.src == element.currentSrc)
            {
                if (menuAction == 2 || (menuAction == 1 && saveHTMLAudioVideo))
                {
                    if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
                    {
                        baseuri = element.ownerDocument.baseURI;
                        
                        passive = !element.hasAttribute("crossorigin");
                        
                        rememberURL(element.src,baseuri,"audio/mpeg","",passive);
                    }
                }
            }
        }
    }
    
    /* External video and image referenced in <video> element */
    
    else if (element.localName == "video")
    {
        if (element.src != "")
        {
            if (element.src == element.currentSrc)
            {
                if (menuAction == 2 || (menuAction == 1 && saveHTMLAudioVideo))
                {
                    if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
                    {
                        baseuri = element.ownerDocument.baseURI;
                        
                        passive = !element.hasAttribute("crossorigin");
                        
                        rememberURL(element.src,baseuri,"video/mp4","",passive);
                    }
                }
            }
        }
        
        if (element.poster != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLAudioVideo))
            {
                if (menuAction == 2 || (menuAction == 1 && saveHTMLImagesAll) ||
                    ((menuAction == 1 && !saveHTMLImagesAll) || menuAction == 0) && displayed)
                {
                    if (!isSchemeDataOrMozExtension(element.poster))  /* exclude existing data uri or moz-extension url */
                    {
                        baseuri = element.ownerDocument.baseURI;
                        
                        rememberURL(element.poster,baseuri,"image/png","",false);
                    }
                }
            }
        }
    }
    
    /* External audio/video/image referenced in <source> element */
    
    else if (element.localName == "source")
    {
        if (element.parentElement.localName == "audio" || element.parentElement.localName == "video")
        {
            if (element.src != "")
            {
                if (element.src == element.parentElement.currentSrc)
                {
                    if (menuAction == 2 || (menuAction == 1 && saveHTMLAudioVideo))
                    {
                        if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
                        {
                            baseuri = element.ownerDocument.baseURI;
                            
                            passive = !element.parentElement.hasAttribute("crossorigin");
                            
                            if (element.parentElement.localName == "audio") rememberURL(element.src,baseuri,"audio/mpeg","",passive);
                            else if (element.parentElement.localName == "video") rememberURL(element.src,baseuri,"video/mp4","",passive);
                        }
                    }
                }
            }
        }
    }
    
    /* External subtitles referenced in <track> element */
    
    else if (element.localName == "track")
    {
        if (element.src != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLAudioVideo))
            {
                if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    charset = element.ownerDocument.characterSet;
                    
                    rememberURL(element.src,baseuri,"text/vtt",charset,false);
                }
            }
        }
    }
    
    /* External data referenced in <object> element */
    
    else if (element.localName == "object")
    {
        if (element.data != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLObjectEmbed))
            {
                if (!isSchemeDataOrMozExtension(element.data))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    rememberURL(element.data,baseuri,"application/octet-stream","",false);
                }
            }
        }
    }
    
    /* External data referenced in <embed> element */
    
    else if (element.localName == "embed")
    {
        if (element.src != "")
        {
            if (menuAction == 2 || (menuAction == 1 && saveHTMLObjectEmbed))
            {
                if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    rememberURL(element.src,baseuri,"application/octet-stream","",false);
                }
            }
        }
    }
    
    /* Handle nested frames and child elements */
    
    if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
    {
        if (depth < maxFrameDepth)
        {
            nosource = nosource || (element.src == "" && element.srcdoc == "");
            
            try
            {
                if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before finding */
                {
                    findOtherResources(depth+1,element.contentWindow,element.contentDocument.documentElement,crossorigin,nosource,loadedfonts);
                }
            }
            catch (e)  /* attempting cross-domain web page access */
            {
                if (retainCrossFrames)
                {
                    for (i = 0; i < crossFrameName.length; i++)
                    {
                        if (crossFrameName[i] == element.name) break;
                    }
                    
                    if (i != crossFrameName.length)
                    {
                        parser = new DOMParser();
                        framedoc = parser.parseFromString(crossFrameHTML[i],"text/html");
                        
                        findOtherResources(depth+1,window,framedoc.documentElement,true,nosource,crossFrameFonts[i]);
                    }
                }
            }
        }
    }
    else
    {
        for (i = 0; i < element.children.length; i++)
            if (element.children[i] != null)  /* in case web page not fully loaded before finding */
                findOtherResources(depth,frame,element.children[i],crossorigin,nosource,loadedfonts);
                
        if (element.localName == "head" && depth == 0)
        {
            if (!iconFound)
            {
                baseuri = element.ownerDocument.baseURI;
                
                rememberURL("/favicon.ico",baseuri,"image/vnd.microsoft.icon","",false);
            }
        }
    }
}

function findCSSURLsInStyleSheet(csstext,baseuri,crossorigin,loadedfonts)
{
    var i,regex,location,fontfamily,fontweight,fontstyle,fontstretch,fontmatches;
    var includewoff,usedfilefound,wofffilefound,srcregex,urlregex,fontfiletype;
    var matches = new Array();
    var propmatches = new Array();
    var srcmatches = new Array();
    var urlmatches = new Array();
    
    /* @import url() or */
    /* @font-face rule or */
    /* image url() or */
    /* avoid matches inside double-quote strings or */
    /* avoid matches inside single-quote strings or */
    /* avoid matches inside comments */
    
    regex = new RegExp(/(?:@import\s*(?:url\(\s*)?((?:"[^"]+")|(?:'[^']+')|(?:[^\s);]+))(?:\s*\))?\s*;)|/.source +  /* matches[1] */
                       /(?:@font-face\s*({[^}]*}))|/.source +  /* matches[2] */
                       /(?:url\(\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s)]+))\s*\))|/.source +  /* matches[3] */
                       /(?:"(?:\\"|[^"])*")|/.source +
                       /(?:'(?:\\'|[^'])*')|/.source +
                       /(?:\/\*(?:\*[^\/]|[^\*])*?\*\/)/.source,
                       "gi");
                       
    while ((matches = regex.exec(csstext)) != null)  /* style sheet imported into style sheet */
    {
        if (matches[0].substr(0,7).toLowerCase() == "@import")  /* @import url() */
        {
            matches[1] = removeQuotes(matches[1]);
            
            if (!isSchemeDataOrMozExtension(matches[1]))  /* exclude existing data uri or moz-extension url */
            {
                if (baseuri != null)
                {
                    location = resolveURL(matches[1],baseuri);
                    
                    if (location != null)
                    {
                        for (i = 0; i < resourceLocation.length; i++)
                            if (resourceLocation[i] == location && resourceStatus[i] == "success") break;
                        
                        if (i < resourceLocation.length)  /* style sheet found */
                        {
                            findCSSURLsInStyleSheet(resourceContent[i],resourceLocation[i],crossorigin,loadedfonts);
                        }
                    }
                }
            }
        }
        else if (matches[0].substr(0,10).toLowerCase() == "@font-face")  /* @font-face rule */
        {
            includewoff = (menuAction == 2 || (menuAction == 1 && saveCSSFontsWoff));
            
            propmatches = matches[2].match(/font-family\s*:\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s;}]+(?: [^\s;}]+)*))/i);
            if (propmatches == null) fontfamily = ""; else fontfamily = removeQuotes(propmatches[1]).toLowerCase();
            
            propmatches = matches[2].match(/font-weight\s*:\s*([^\s;}]*)/i);
            if (propmatches == null) fontweight = "normal"; else fontweight = propmatches[1].toLowerCase();
            
            propmatches = matches[2].match(/font-style\s*:\s*([^\s;}]*)/i);
            if (propmatches == null) fontstyle = "normal"; else fontstyle = propmatches[1].toLowerCase();
            
            propmatches = matches[2].match(/font-stretch\s*:\s*([^\s;}]*)/i);
            if (propmatches == null) fontstretch = "normal"; else fontstretch = propmatches[1].toLowerCase();
            
            fontmatches = false;
            
            for (i = 0; i < loadedfonts.length; i++)
            {
                if (removeQuotes(loadedfonts[i].family).toLowerCase() == fontfamily && loadedfonts[i].weight == fontweight &&
                    loadedfonts[i].style == fontstyle && loadedfonts[i].stretch == fontstretch) fontmatches = true;  /* font matches this @font-face rule */
            }
            
            if (fontmatches)
            {
                usedfilefound = false;
                wofffilefound = false;
                
                srcregex = /src:([^;}]*)[;}]/gi;  /* @font-face src list */
                
                while ((srcmatches = srcregex.exec(matches[2])) != null)  /* src: list of font file URL's */
                {
                    urlregex = /url\(\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s)]+))\s*\)(?:\s+format\(([^)]*)\))?/gi;  /* font url() and optional font format() list */
                    
                    while ((urlmatches = urlregex.exec(srcmatches[1])) != null)  /* font file URL */
                    {
                        urlmatches[1] = removeQuotes(urlmatches[1]);  /* url */
                        
                        if (!isSchemeDataOrMozExtension(urlmatches[1]))  /* exclude existing data uri or moz-extension url */
                        {
                            fontfiletype = "";
                            
                            if (typeof urlmatches[2] != "undefined")  /* font format() list */
                            {
                                urlmatches[2] = urlmatches[2].replace(/"/g,"'");
                                
                                if (urlmatches[2].indexOf("'woff2'") >= 0) fontfiletype = "woff2";  /* Firefox, Chrome & Opera */
                                else if (urlmatches[2].indexOf("'woff'") >= 0) fontfiletype = "woff";  /* all browsers */
                                else if (urlmatches[2].indexOf("'truetype'") >= 0) fontfiletype = "ttf";  /* all browsers */
                                else if (urlmatches[2].indexOf("'opentype'") >= 0) fontfiletype = "otf";  /* all browsers */
                                else if (urlmatches[2].indexOf("'svg'") >= 0) fontfiletype = "svg";  /* Chrome & Opera */
                            }
                            else
                            {
                                if (urlmatches[1].indexOf(".woff2") >= 0) fontfiletype = "woff2";  /* Firefox, Chrome & Opera */
                                else if (urlmatches[1].indexOf(".woff") >= 0 && urlmatches[1].indexOf(".woff2") < 0) fontfiletype = "woff";  /* all browsers */
                                else if (urlmatches[1].indexOf(".ttf") >= 0) fontfiletype = "ttf";  /* all browsers */
                                else if (urlmatches[1].indexOf(".otf") >= 0) fontfiletype = "otf";  /* all browsers */
                                else if (urlmatches[1].indexOf(".svg") >= 0) fontfiletype = "svg";  /* Chrome & Opera */
                            }
                            
                            if (fontfiletype != "")
                            {
                                if (!usedfilefound)
                                {
                                    usedfilefound = true;  /* first font file supported by this browser - should be the one used by this browser */
                                    
                                    if (fontfiletype == "woff") wofffilefound = true;
                                    
                                    rememberURL(urlmatches[1],baseuri,"application/font-woff","",false);
                                }
                                else if (includewoff && fontfiletype == "woff")
                                {
                                    wofffilefound = true;  /* woff font file supported by all browsers */
                                    
                                    rememberURL(urlmatches[1],baseuri,"application/font-woff","",false);
                                }
                            }
                            
                            if (wofffilefound || (!includewoff && usedfilefound)) break;
                        }
                    }
                    
                    if (wofffilefound || (!includewoff && usedfilefound)) break;
                }
            }
        }
        else if (matches[0].substr(0,4).toLowerCase() == "url(")  /* image url() */
        {
            if ((menuAction == 1 && saveCSSImagesAll))
            {
                matches[3] = removeQuotes(matches[3]);
                
                if (!isSchemeDataOrMozExtension(matches[3]))  /* exclude existing data uri or moz-extension url */
                {
                    rememberURL(matches[3],baseuri,"image/png","",false);
                }
            }
        }
        else if (matches[0].substr(0,1) == "\"") ;  /* double-quote string */
        else if (matches[0].substr(0,1) == "'") ;  /* single-quote string */
        else if (matches[0].substr(0,2) == "/*") ;  /* comment */
    }
}

function rememberURL(url,baseuri,mimetype,charset,passive)
{
    var i,location;
    
    if (savedPage) return -1;  /* ignore new resources when re-saving */
    
    if (baseuri != null)
    {
        location = resolveURL(url,baseuri);
        
        if (location != null)
        {
            for (i = 0; i < resourceLocation.length; i++)
                if (resourceLocation[i] == location) break;

            if (i == resourceLocation.length)  /* new resource */ {
                resourceLocation[i] = location;
                resourceReferer[i] = baseuri;
                resourceMimeType[i] = mimetype;  /* default if load fails */
                resourceCharSet[i] = charset;  /* default if load fails */
                resourcePassive[i] = passive;
                resourceContent[i] = "";  /* default if load fails */
                resourceStatus[i] = "pending";
                resourceReason[i] = "";
                resourceRemembered[i] = 1;
                resourceReplaced[i] = 0;
                return i;
            }
            else resourceRemembered[i]++;  /* repeated resource */
        }
    }
    
    return -1;
}

/************************************************************************/

/* After first or second pass - load resources */


function loadResources()
{
    var i,documentURL,useCORS;
    
    timeStart[passNumber+3] = performance.now();
    
    resourceCount = 0;
    
    timeFinish[passNumber + 3] = performance.now();

    if (passNumber == 1) gatherOtherResources();
    else if (passNumber == 2) loadInfoBar();
}

function loadSuccess(index,content,contenttype,alloworigin)
{
    var i,mimetype,charset,resourceURL,frameURL,csstext,baseuri,regex,documentURL;
    var matches = new Array();
    
    /* Extract file MIME type and character set */

    if (contenttype) {
        matches = contenttype.match(/([^;]+)/i);
    }
    else {
        matches = null;
    }
    if (matches != null) mimetype = matches[1].toLowerCase();
    else mimetype = "";

    if (contenttype) {
        matches = contenttype.match(/;charset=([^;]+)/i);
    }
    else {
        matches = null;
    }
    if (matches != null) charset = matches[1].toLowerCase();
    else charset = "";
    
    /* Process file based on expected MIME type */
    
    switch (resourceMimeType[index].toLowerCase())  /* expected MIME type */
    {
        case "application/font-woff":  /* font file */
            
            /* CORS check required */
            
            if (alloworigin != "*")  /* restricted origin */
            {
                resourceURL = new URL(resourceLocation[index]);
                frameURL = new URL(resourceReferer[index]);
                
                if (resourceURL.origin != frameURL.origin &&  /* cross-origin resource */
                    (alloworigin == "" || alloworigin != frameURL.origin))  /* either no header or no origin match */
                {
                    loadFailure(index,"cors");
                    return;
                }
            }
            
        case "image/png":  /* image file */
        case "image/vnd.microsoft.icon":  /* icon file */
        case "audio/mpeg":  /* audio file */
        case "video/mp4":  /* video file */
        case "application/octet-stream":  /* data file */
            
            if (mimetype != "") resourceMimeType[index] = mimetype;
            
            resourceContent[index] = content;
            
            break;
            
        case "application/javascript":  /* javascript file */
            
            if (mimetype != "application/javascript" && mimetype != "application/x-javascript" && mimetype != "application/ecmascript" &&
                mimetype != "application/json" && mimetype != "text/javascript" && mimetype != "text/x-javascript" && mimetype != "text/json")  /* incorrect MIME type */
            {
                loadFailure(index,"mime");
                return;
            }
            
        case "text/vtt":  /* subtitles file */
            
            if (mimetype != "") resourceMimeType[index] = mimetype;
            if (charset != "") resourceCharSet[index] = charset;
            
            if (content.charCodeAt(0) == 0xEF && content.charCodeAt(1) == 0xBB && content.charCodeAt(2) == 0xBF)  /* BOM */
            {
                resourceCharSet[index] = "utf-8";
                content = content.substr(3);
            }
            
            if (resourceCharSet[index].toLowerCase() == "utf-8")
            {
                try
                {
                    resourceContent[index] = convertUTF8ToUTF16(content);  /* UTF-8 */
                }
                catch (e)
                {
                    resourceCharSet[index] = "iso-8859-1";  /* assume ISO-8859-1 */
                    resourceContent[index] = content;
                }
            }
            else resourceContent[index] = content;  /* ASCII, ANSI, ISO-8859-1, etc */
            
            break;
            
        case "text/css":  /* css file */
            
            if (mimetype != "text/css")  /* incorrect MIME type */
            {
                loadFailure(index,"mime");
                return;
            }
            
            matches = content.match(/^@charset "([^"]+)";/i);
            if (matches != null) resourceCharSet[index] = matches[1];
            
            if (charset != "") resourceCharSet[index] = charset;
            
            if (content.charCodeAt(0) == 0xEF && content.charCodeAt(1) == 0xBB && content.charCodeAt(2) == 0xBF)  /* BOM */
            {
                resourceCharSet[index] = "utf-8";
                content = content.substr(3);
            }
            
            if (resourceCharSet[index].toLowerCase() == "utf-8")
            {
                try
                {
                    resourceContent[index] = convertUTF8ToUTF16(content);  /* UTF-8 */
                }
                catch (e)
                {
                    resourceCharSet[index] = "iso-8859-1";  /* assume ISO-8859-1 */
                    resourceContent[index] = content;
                }
            }
            else resourceContent[index] = content;  /* ASCII, ANSI, ISO-8859-1, etc */
            
            /* External style sheets imported in external style sheet */
            
            csstext = resourceContent[index];
            
            baseuri = resourceLocation[index];
            
            regex = /@import\s*(?:url\(\s*)?((?:"[^"]+")|(?:'[^']+')|(?:[^\s);]+))(?:\s*\))?\s*;/gi;  /* @import url() */
            
            while ((matches = regex.exec(csstext)) != null)  /* style sheet imported into style sheet */
            {
                matches[1] = removeQuotes(matches[1]);
                
                if (!isSchemeDataOrMozExtension(matches[1]))  /* exclude existing data uri or moz-extension url */
                {
                    i = rememberURL(matches[1],baseuri,"text/css",resourceCharSet[index],false);
                    
                    if (i >= 0)
                    {
                        resourceCount++;
                        
                        documentURL = new URL(document.baseURI);
                        
                        //chrome.runtime.sendMessage({ type: "loadResource", index: i, location: resourceLocation[i], referer: resourceReferer[i],
                        //                             passive: resourcePassive[i], pagescheme: documentURL.protocol, useCORS: false });
                    }
                }
            }
            
            break;
    }
    
    resourceStatus[index] = "success";
}

function loadFailure(index,reason)
{
    resourceStatus[index] = "failure";
    
    resourceReason[index] = reason;    
}

/************************************************************************/

/* After second pass - load local files */

function loadInfoBar()
{
    //here we return and let puppeteer load all the resources
}

function loadPageLoader(scrapedResources)
{
    for (var i in scrapedResources) {
        if (scrapedResources[i].success) {
            loadSuccess(i, scrapedResources[i].content, scrapedResources[i].mime, "*");
        }
        else {
            loadFailure(i, "missing");
        }
    }
    checkResources();
}

/************************************************************************/

/* After second pass - check resources */

function checkResources()
{
    var i,dataurisize,skipcount,failcount,iconlocation,count;
    var skipinflist = new Array();
    var skipurllist = new Array();
    var failinflist = new Array();
    var failurllist = new Array();
    
    /* Check for large resource sizes and failed resource loads */
    
    if (!savedPage)
    {
        dataurisize = 0;
        skipcount = 0;
        failcount = 0;
        
        iconlocation = resolveURL("/favicon.ico",document.baseURI);
        
        for (i = 0; i < resourceLocation.length; i++)
        {
            if (resourceCharSet[i] == "")  /* charset not defined - binary data */
            {
                count = usePageLoader ? 1 : resourceRemembered[i];
                
                if (resourceContent[i].length*count*(4/3) > maxResourceSize*1024*1024)  /* skip large and/or repeated resource */  /* base64 expands by 4/3 */
                {
                  skipcount++;
                  skipinflist.push((resourceContent[i].length*count*(4/3)/(1024*1024)).toFixed(1) + " MB");
                  try { skipurllist.push(decodeURIComponent(resourceLocation[i])); }
                  catch (e) { skipurllist.push(resourceLocation[i]); }
                }
                else dataurisize += resourceContent[i].length*count*(4/3);  /* base64 expands by 4/3 */
            }
            
            if (resourceStatus[i] == "failure")
            {
                if (!iconFound && resourceLocation[i] == iconlocation && resourceMimeType[i] == "image/vnd.microsoft.icon" && resourceReason[i] == "load:404")
                {
                    resourceLocation.splice(i,1);
                    resourceReferer.splice(i,1);
                    resourceMimeType.splice(i,1);
                    resourceCharSet.splice(i,1);
                    resourcePassive.splice(i,1);
                    resourceContent.splice(i,1);
                    resourceStatus.splice(i,1);
                    resourceReason.splice(i,1);
                    resourceRemembered.splice(i,1);
                    resourceReplaced.splice(i,1);
                    i--;
                }
                else
                {
                    failcount++;
                    failinflist.push(resourceReason[i]);
                    try { failurllist.push(decodeURIComponent(resourceLocation[i])); }
                    catch (e) { failurllist.push(resourceLocation[i]); }
                }
            }
        }
        
        if (dataurisize > maxTotalSize*1024*1024)
        {
            //save failed!
            return;
        }
    }

    generateHTML();        
}


/************************************************************************/

/* Third Pass - to generate HTML and save to file */

function generateHTML()
{
    var i,j,totalscans,totalloads,maxstrsize,totalstrsize,mimetype,charset;
    
    for (i = 0; i < crossFrameName.length; i++)
    {
        // console.log("Main  - Array - " + i + " - " + (crossFrameName[i] + "                         ").substr(0,25) + " - " +
                    // (crossFrameURL[i] + "                                                            ").replace(/\:/g,"").substr(0,80));  /*???*/
    }
    
    passNumber = 3;
    
    //chrome.runtime.sendMessage({ type: "setSaveBadge", text: "SAVE", color: "#0000E0" });
    
    /* Generate HTML enhanced */
    
    timeStart[3] = performance.now();
    
    extractHTML(0,window,document.documentElement,false,false,0,0);
    
    timeFinish[3] = performance.now();
    
    /* Append metrics and resource summary */
    
    if (includeSummary)
    {
        totalscans = retainCrossFrames ? timeFinish[0]-timeStart[0] : 0;
        totalscans += timeFinish[1]-timeStart[1]+timeFinish[2]-timeStart[2]+timeFinish[3]-timeStart[3];
        totalloads = timeFinish[4]-timeStart[4]+timeFinish[5]-timeStart[5];
        
        htmlStrings[htmlStrings.length] = "\n\n<!--\n\n";
        
        if (retainCrossFrames) htmlStrings[htmlStrings.length] = "Pass 0 scan:  " + ("     " + Math.round(timeFinish[0]-timeStart[0])).substr(-6) + " ms\n";
        htmlStrings[htmlStrings.length] = "Pass 1 scan:  " + ("     " + Math.round(timeFinish[1]-timeStart[1])).substr(-6) + " ms\n";
        htmlStrings[htmlStrings.length] = "Pass 2 scan:  " + ("     " + Math.round(timeFinish[2]-timeStart[2])).substr(-6) + " ms\n";
        htmlStrings[htmlStrings.length] = "Pass 3 scan:  " + ("     " + Math.round(timeFinish[3]-timeStart[3])).substr(-6) + " ms\n";
        htmlStrings[htmlStrings.length] = "Total scans:  " + ("     " + Math.round(totalscans)).substr(-6) + " ms\n\n";
        
        htmlStrings[htmlStrings.length] = "Pass 1 loads: " + ("     " + Math.round(timeFinish[4]-timeStart[4])).substr(-6) + " ms\n";
        htmlStrings[htmlStrings.length] = "Pass 2 loads: " + ("     " + Math.round(timeFinish[5]-timeStart[5])).substr(-6) + " ms\n";
        htmlStrings[htmlStrings.length] = "Total loads:  " + ("     " + Math.round(totalloads)).substr(-6) + " ms\n\n";
        
        htmlStrings[htmlStrings.length] = "String count:     "  + ("    " + htmlStrings.length).substr(-5) + "\n";
        
        maxstrsize = totalstrsize = 0;
        
        for (i = 0; i < htmlStrings.length; i++)
        {
            totalstrsize += htmlStrings[i].length;
            
            if (htmlStrings[i].length > maxstrsize) maxstrsize = htmlStrings[i].length;
        }
        
        htmlStrings[htmlStrings.length] = "Max size:      "  + ("       " + maxstrsize).substr(-8) + "\n";
        htmlStrings[htmlStrings.length] = "Total size:   "  + ("        " + totalstrsize).substr(-9) + "\n\n";
        
        htmlStrings[htmlStrings.length] = "Resource count:    "  + ("   " + resourceLocation.length).substr(-4) + "\n\n";
        
        htmlStrings[htmlStrings.length] = "Refs  Reps  Status   Reason    MimeType    CharSet   ByteSize    URL\n\n";
        
        for (i = 0; i < resourceLocation.length; i++)
        {
            j = resourceMimeType[i].indexOf("/");
            
            mimetype = resourceMimeType[i].substr(0,j).substr(0,5);
            mimetype += "/";
            mimetype += resourceMimeType[i].substr(j+1,4);
            
            charset = (resourceCharSet[i] == "") ? "binary" : resourceCharSet[i];
            
            htmlStrings[htmlStrings.length] = ("    " + resourceRemembered[i]).substr(-4) + "  " +
                                              ("    " + resourceReplaced[i]).substr(-4) + "  " +
                                              resourceStatus[i] + "  " +
                                              (resourceReason[i] + "        ").substr(0,8) + "  " +
                                              (mimetype + "          ").substr(0,10) + "  " +
                                              (charset + "        ").substr(0,8) + "  " +
                                              ("        " + resourceContent[i].length).substr(-8) + "    " +
                                              resourceLocation[i] + "\n";
        }
        
        htmlStrings[htmlStrings.length] = "\n-->\n";
    }
    
    /* Release resources */
    
    crossFrameName.length = 0;
    crossFrameURL.length = 0;
    crossFrameHTML.length = 0;
    crossFrameFonts.length = 0;
    
    resourceLocation.length = 0;
    resourceReferer.length = 0;
    resourceMimeType.length = 0;
    resourceCharSet.length = 0;
    resourcePassive.length = 0;
    resourceContent.length = 0;
    resourceStatus.length = 0;
    resourceReason.length = 0;
    resourceRemembered.length = 0;
    resourceReplaced.length = 0;
    
    pageLoaderText = "";
    
    /* Code to test large saved file sizes */
    
    // var i,j,size,length;
    
    // size = 0;
    
    // length = htmlStrings.length;
    
    // for (i = 0; i < 1000; i++)
    // {
        // for (j = 0; j < length; j++)
        // {
            // size += htmlStrings[j].length;
            
            // if (i > 0) htmlStrings[htmlStrings.length] = htmlStrings[j];
        // }
    // }
    
    // alert(Math.trunc(size/(1024*1024))+"MB");
    
    /* Save to file using HTML5 download attribute */
    
    //filename = getSavedFileName(document.baseURI,document.title,false);
    htmlOutput = htmlStrings.join('');       
    htmlStrings.length = 0;    
}

function extractHTML(depth,frame,element,crossorigin,nosource,parentpreserve,indent)
{
    var i,j,style,inline,preserve,property,displayed,startTag,endTag,textContent,baseuri,location,csstext,origurl,datauri,origstr;
    var visible,width,height,currentsrc,htmltext,startindex,endindex,origdoc,parser,framedoc,doctype,target,text,date,state;
    var retainElements = new Array("html","head","body","base","command","link","meta","noscript","script","style","template","title");
    var voidElements = new Array("area","base","br","col","command","embed","frame","hr","img","input","keygen","link","menuitem","meta","param","source","track","wbr");
    var htmlFrameStrings = new Array();
    var matches = new Array();
    
    /* Determine if element is phrasing content - based on CSS display value */
    
    /* Determine if element format should be preserved - based on CSS white-space value */
    /*   0 = collapse newlines, collapse spaces (normal or nowrap) */
    /*   1 = preserve newlines, collapse spaces (pre-line)         */
    /*   2 = preserve newlines, preserve spaces (pre or pre-wrap)  */
    
    if (formatHTML && depth == 0)
    {
        if ((style = frame.getComputedStyle(element)) == null)
        {
            inline = false;
            preserve = 0;
        }
        else
        {
            property = style.getPropertyValue("display");
            if (property.indexOf("inline") >= 0) inline = true;
            else inline = false;
            
            property = style.getPropertyValue("white-space");
            if (property == "pre" || property == "pre-nowrap") preserve = 2;
            else if (property == "pre-line") preserve = 1;
            else preserve = 0;
        }
    }
    else preserve = 0;
    
    /* Purge elements that were deleted by Print Edit WE and are not currently displayed */
    
    if (purgeDeleted)
    {
        if (false)
        {
            /* In cross-origin frames, the passed-in frame is actually the page window,      */
            /* instead of the frame window, because the frame window is not accessible.      */
            /* This means that the getComputedStyle() function from the page window is used. */
            /* This should work, since all getComputedStyle() functions should be the same.  */
            /* With Firefox 51-54, this causes large delays and may return incorrect styles. */
            
            /* The workaround is to not purge elements that are not currently displayed. */
            
            displayed = true;
        }
        else if ((style = frame.getComputedStyle(element)) == null) displayed = true;
        else displayed = (style.getPropertyValue("display") != "none");
    }
    else displayed = true;
    
    /* Do not purge essential HTML elements */
    /* Do not purge <svg> elements because child elements may be referenced by <use> elements in other <svg> elements */
    
    if (retainElements.indexOf(element.localName) < 0 && !(element instanceof SVGElement) && !displayed) return;
    
    /* Extract HTML from DOM and replace external resources with data URI's */
    
    startTag = "<" + element.localName;
    for (i = 0; i < element.attributes.length; i++)
    {
        if (element.attributes[i].name != "zoompage-fontsize")
        {
            startTag += " " + element.attributes[i].name;
            startTag += "=\"";
            startTag += element.attributes[i].value.replace(/"/g,"&quot;");
            startTag += "\"";
        }
    }
    startTag += ">";
    
    textContent = "";
    
    if (voidElements.indexOf(element.localName) >= 0) endTag = "";
    else endTag = "</" + element.localName + ">";
    
    /* External images referenced in any element's style attribute */
    
    if (element.hasAttribute("style"))
    {
        csstext = element.getAttribute("style");
        
        baseuri = element.ownerDocument.baseURI;
        
        csstext = replaceCSSURLs(csstext,baseuri,crossorigin);
        
        startTag = startTag.split("style=\"" + element.getAttribute("style").replace(/"/g,"&quot;") + "\"").join("style=\"" + csstext.replace(/"/g,"&quot;") + "\"");
    }
    
    /* Internal script in <script> element */
    /* External script in <script> element */
    
    if (element.localName == "script")
    {
        if (element.src == "")  /* internal script */
        {
            if ((menuAction == 1 && saveScripts) && !crossorigin && !nosource) textContent = element.textContent;
        }
        else /* element.src != "" */  /* external script */
        {
            if ((menuAction == 1 && saveScripts) && !crossorigin && !nosource)
            {
                if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    origurl = element.getAttribute("src");
                    
                    datauri = replaceURL(origurl,baseuri,crossorigin);
                    
                    origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                    
                    startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
                }
            }
            else
            {
                origurl = element.getAttribute("src");
                
                origstr = " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"\"");
            }
        }
    }
    
    /* External images or fonts referenced in <style> element */
    
    else if (element.localName == "style")
    {
        if (element.id == "zoompage-pageload-style" || element.id == "zoompage-zoomlevel-style" || element.id == "zoompage-fontsize-style")
        {
            startTag = "";
            endTag = "";
            textContent = "";
        }
        else
        {
            if (!element.disabled)
            {
                if (element.hasAttribute("data-styled-components") && element.textContent == "")
                {
                    /* Workaround for 'styled components' issue #1571 - for example reddit.com pages */
                    
                    csstext = "";
                    
                    for (i = 0; i < element.sheet.cssRules.length; i++)
                        csstext += element.sheet.cssRules[i].cssText;
                }
                else csstext = element.textContent;
                
                baseuri = element.ownerDocument.baseURI;
                
                textContent = replaceCSSURLsInStyleSheet(csstext,baseuri,crossorigin);
                
                if (swapDevices) textContent = swapScreenAndPrintDevices(textContent);
            }
            else
            {
                startTag = startTag.replace(/<style/,"<style data-savepage-disabled=\"\"");
                
                textContent = "";
            }
        }
    }
    
    /* External images or fonts referenced in <link> element */
    /* External icon referenced in <link> element */
    
    else if (element.localName == "link")
    {
        if (element.rel.toLowerCase() == "stylesheet" && element.getAttribute("href") != "" && element.href != "")  /* href attribute and property may be different */
        {
            if (!element.disabled)
            {
                if (!isSchemeDataOrMozExtension(element.href))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    if (baseuri != null)
                    {
                        location = resolveURL(element.href,baseuri);
                        
                        if (location != null)
                        {
                            for (i = 0; i < resourceLocation.length; i++)
                                if (resourceLocation[i] == location && resourceStatus[i] == "success") break;
                            
                            if (i < resourceLocation.length)  /* style sheet found */
                            {
                                csstext = resourceContent[i];
                                
                                /* Converting <link> into <style> means that CSS rules are embedded in saved HTML file */
                                /* Therefore need to escape any </style> end tags that may appear inside CSS strings */
                                
                                csstext = csstext.replace(/<\/style>/gi,"<\\/style>");
                                
                                baseuri = element.href;
                                
                                textContent = replaceCSSURLsInStyleSheet(csstext,baseuri,crossorigin);
                                
                                if (swapDevices) textContent = swapScreenAndPrintDevices(textContent);
                                
                                startTag = "<style data-savepage-href=\"" + element.getAttribute("href") + "\"";
                                if (element.type != "") startTag += " type=\"" + element.type + "\"";
                                if (element.media != "") startTag += " media=\"" + element.media + "\"";
                                startTag += ">";
                                endTag = "</style>";
                                
                                resourceReplaced[i]++;
                            }
                        }
                    }
                }
            }
            else
            {
                origurl = element.getAttribute("href");
                
                origstr = " data-savepage-href=\"" + origurl + "\" data-savepage-disabled=\"\"";
                
                startTag = startTag.replace(/ href="[^"]*"/,origstr + " href=\"\"");
            }
        }
        else if ((element.rel.toLowerCase() == "icon" || element.rel.toLowerCase() == "shortcut icon") && element.href != "")
        {
            if (!isSchemeDataOrMozExtension(element.href))  /* exclude existing data uri or moz-extension url */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("href");
                
                datauri = replaceURL(origurl,baseuri,crossorigin);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-href=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ href="[^"]*"/,origstr + " href=\"" + datauri + "\"");
            }
        }
    }
    
    /* Remove existing base element */
    
    else if (element.localName == "base")
    {
        startTag = "";
        endTag = "";
    }
    
    /* Remove previous saved page information */
    
    else if (element.localName == "meta")
    {
        if (element.name.substr(0,8) == "savepage")
        {
            startTag = "";
            endTag = "";
        }
    }
    
    /* External image referenced in <body> element */
    
    else if (element.localName == "body")
    {
        if (element.background != "")
        {
            if (!isSchemeDataOrMozExtension(element.background))  /* exclude existing data uri or moz-extension url */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("background");
                
                datauri = replaceURL(origurl,baseuri,crossorigin);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-background=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ background="[^"]*"/,origstr + " background=\"" + datauri + "\"");
            }
        }
    }
    
    /* External image referenced in <img> element - can be inside <picture> element */
    
    else if (element.localName == "img")
    {
        /* Purge images that were hidden by Print Edit WE and are not currently visible */
        
        if (purgeHidden)
        {
            if (false)
            {
                /* In cross-origin frames, the passed-in frame is actually the page window,      */
                /* instead of the frame window, because the frame window is not accessible.      */
                /* This means that the getComputedStyle() function from the page window is used. */
                /* This should work, since all getComputedStyle() functions should be the same.  */
                /* With Firefox 51-54, this causes large delays and may return incorrect styles. */
                
                /* The workaround is to not purge images that are not currently visible. */
                
                visible = true;
            }
            else if ((style = frame.getComputedStyle(element)) == null) visible = true;
            else visible = (style.getPropertyValue("visibility") != "hidden" && style.getPropertyValue("opacity") != "0");
        }
        else visible = true;
        
        if (!visible)
        {
            width = style.getPropertyValue("width");
            height = style.getPropertyValue("height");
            
            startTag = "<img style=\"display: inline-block; width: " + width + "; height: " + height + ";\">";
        }
        else
        {
            /* currentSrc is set from src or srcset attributes on this <img> element */
            /* or from srcset attribute on <source> element inside <picture> element */
            
            /* Firefox - workaround because currentSrc may be null string in cross-origin frames */
            
            currentsrc = (element.currentSrc == "") ? element.src : element.currentSrc;
            
            if (currentsrc != "")
            {
                if (element.src == currentsrc)  /* currentSrc set from src attribute */
                {
                    if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
                    {
                        baseuri = element.ownerDocument.baseURI;
                        
                        origurl = element.getAttribute("src");
                        
                        datauri = replaceURL(origurl,baseuri,crossorigin);
                        
                        origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                        
                        startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
                    }
                }
                else  /* currentSrc set from srcset attribute */
                {
                    if (!isSchemeDataOrMozExtension(currentsrc))  /* exclude existing data uri or moz-extension url */
                    {
                        baseuri = element.ownerDocument.baseURI;
                        
                        origurl = (element.src == "") ? "" : element.getAttribute("src");
                        
                        datauri = replaceURL(currentsrc,baseuri,crossorigin);
                        
                        origstr = " data-savepage-src=\"" + origurl + "\"" + " data-savepage-currentsrc=\"" + currentsrc + "\"";
                        
                        startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
                    }
                    else  /* existing data uri */
                    {
                        origurl = (element.src == "") ? "" : element.getAttribute("src");
                        
                        datauri = currentsrc;
                        
                        origstr = " data-savepage-src=\"" + origurl + "\"";
                        
                        startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
                    }
                }
            }
            
            if (element.srcset != "")
            {
                origurl = element.getAttribute("srcset");
                
                origstr = " data-savepage-srcset=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ srcset="[^"]*"/,origstr + " srcset=\"\"");
            }
        }
    }
    
    /* External image referenced in <input> element */
    /* Reinstate checked state or text value of <input> element */
    
    else if (element.localName == "input")
    {
        if (element.type.toLowerCase() == "image" && element.src != "")
        {
            if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("src");
                
                datauri = replaceURL(origurl,baseuri,crossorigin);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
            }
        }
        
        if (element.type.toLowerCase() == "file" || element.type.toLowerCase() == "password")
        {
            /* maintain security */
        }
        else if (element.type.toLowerCase() == "checkbox" || element.type.toLowerCase() == "radio")
        {
            if (element.checked) startTag = startTag.replace(/ checked="[^"]*"/," checked=\"\"");
            else startTag = startTag.replace(/ checked="[^"]*"/,"");
        }
        else
        {
            if (element.hasAttribute("value")) startTag = startTag.replace(/ value="[^"]*"/," value=\"" + element.value + "\"");
            else startTag = startTag.replace(/<input/,"<input value=\"" + element.value + "\"");
        }
    }
    
    /* Reinstate text value of <textarea> element */
    
    else if (element.localName == "textarea")
    {
        textContent = element.value;
    }
    
    /* Reinstate selected state of <option> element */
    
    else if (element.localName == "option")
    {
        if (element.selected) startTag = startTag.replace(/ selected="[^"]*"/," selected=\"\"");
        else startTag = startTag.replace(/ selected="[^"]*"/,"");
    }
    
    /* External audio referenced in <audio> element */
    
    else if (element.localName == "audio")
    {
        if (element.src != "")
        {
            if (element.src == element.currentSrc)
            {
                if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    origurl = element.getAttribute("src");
                    
                    datauri = replaceURL(origurl,baseuri,crossorigin);
                    
                    origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                    
                    startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
                }
            }
            else if (removeUnsavedURLs)
            {
                origurl = element.getAttribute("src");
                
                origstr = " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"\"");
            }
        }
    }
    
    /* External video referenced in <video> element */
    
    else if (element.localName == "video")
    {
        if (element.src != "")
        {
            if (element.src == element.currentSrc)
            {
                if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
                {
                    baseuri = element.ownerDocument.baseURI;
                    
                    origurl = element.getAttribute("src");
                    
                    datauri = replaceURL(origurl,baseuri,crossorigin);
                    
                    origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                    
                    startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
                }
            }
            else if (removeUnsavedURLs)
            {
                origurl = element.getAttribute("src");
                
                origstr = " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"\"");
            }
        }
        
        if (element.poster != "")
        {
            if (!isSchemeDataOrMozExtension(element.poster))  /* exclude existing data uri or moz-extension url */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("poster");
                
                datauri = replaceURL(origurl,baseuri,crossorigin);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-poster=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ poster="[^"]*"/,origstr + " poster=\"" + datauri + "\"");
            }
        }
    }
    
    /* External audio/video/image referenced in <source> element */
    
    else if (element.localName == "source")
    {
        if (element.parentElement.localName == "audio" || element.parentElement.localName == "video")
        {
            if (element.src != "")
            {
                if (element.src == element.parentElement.currentSrc)
                {
                    if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
                    {
                        baseuri = element.ownerDocument.baseURI;
                        
                        origurl = element.getAttribute("src");
                        
                        datauri = replaceURL(origurl,baseuri,crossorigin);
                        
                        origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                        
                        startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
                    }
                }
                else if (removeUnsavedURLs)
                {
                    origurl = element.getAttribute("src");
                    
                    origstr = " data-savepage-src=\"" + origurl + "\"";
                    
                    startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"\"");
                }
            }
        }
        else if (element.parentElement.localName == "picture")
        {
            if (element.srcset != "")
            {
                if (removeUnsavedURLs)
                {
                    origurl = element.getAttribute("srcset");
                    
                    origstr = " data-savepage-srcset=\"" + origurl + "\"";
                    
                    startTag = startTag.replace(/ srcset="[^"]*"/,origstr + " srcset=\"\"");
                }
            }
        }
    }
    
    /* External subtitles referenced in <track> element */
    
    else if (element.localName == "track")
    {
        if (element.src != "")
        {
            if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("src");
                
                datauri = replaceURL(origurl,baseuri,crossorigin);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
            }
        }
    }
    
    /* External data referenced in <object> element */
    
    else if (element.localName == "object")
    {
        if (element.data != "")
        {
            if (!isSchemeDataOrMozExtension(element.data))  /* exclude existing data uri or moz-extension url */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("data");
                
                datauri = replaceURL(origurl,baseuri,crossorigin);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-data=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ data="[^"]*"/,origstr + " data=\"" + datauri + "\"");
            }
        }
    }
    
    /* External data referenced in <embed> element */
    
    else if (element.localName == "embed")
    {
        if (element.src != "")
        {
            if (!isSchemeDataOrMozExtension(element.src))  /* exclude existing data uri or moz-extension url */
            {
                baseuri = element.ownerDocument.baseURI;
                
                origurl = element.getAttribute("src");
                
                datauri = replaceURL(origurl,baseuri,crossorigin);
                
                origstr = (datauri == origurl) ? "" : " data-savepage-src=\"" + origurl + "\"";
                
                startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
            }
        }
    }
    
    /* Handle nested frames and child elements & text nodes & comment nodes */
    /* Generate HTML into array of strings */
    
    if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
    {
        datauri = null;
        
        if (depth < maxFrameDepth)
        {
            nosource = nosource || (element.src == "" && element.srcdoc == "");
            
            try
            {
                if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before extracting */
                {
                    startindex = htmlStrings.length;
                    
                    extractHTML(depth+1,element.contentWindow,element.contentDocument.documentElement,crossorigin,nosource,preserve,indent+2);
                    
                    endindex = htmlStrings.length;
                    
                    htmlFrameStrings = htmlStrings.splice(startindex,endindex-startindex);
                    
                    htmltext = htmlFrameStrings.join("");
                    
                    datauri = "data:text/html;charset=utf-8," + encodeURIComponent(htmltext);
                    
                    startTag = startTag.replace(/(<iframe|<frame)/,"$1 data-savepage-sameorigin=\"\"");
                    
                    if (element.src != "")
                    {
                        origurl = element.getAttribute("src");
                        
                        origstr = " data-savepage-src=\"" + origurl + "\"";
                        
                        startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
                    }
                    else startTag = startTag.replace(/(<iframe|<frame)/,"$1 src=\"" + datauri + "\"");
                    
                    if (element.hasAttribute("srcdoc"))
                    {
                        origdoc = element.getAttribute("srcdoc");
                        
                        origstr = " data-savepage-srcdoc=\"" + origdoc + "\"";
                        
                        startTag = startTag.replace(/ srcdoc="[^"]*"/,origstr);
                    }
                }
            }
            catch (e)  /* attempting cross-domain web page access */
            {
                if (retainCrossFrames)
                {
                    for (i = 0; i < crossFrameName.length; i++)
                    {
                        if (crossFrameName[i] == element.name) break;
                    }
                    
                    if (i != crossFrameName.length)
                    {
                        parser = new DOMParser();
                        framedoc = parser.parseFromString(crossFrameHTML[i],"text/html");
                        
                        startindex = htmlStrings.length;
                        
                        extractHTML(depth+1,window,framedoc.documentElement,true,nosource,preserve,indent+2);
                        
                        endindex = htmlStrings.length;
                        
                        htmlFrameStrings = htmlStrings.splice(startindex,endindex-startindex);
                        
                        htmltext = htmlFrameStrings.join("");
                        
                        datauri = "data:text/html;charset=utf-8," + encodeURIComponent(htmltext);
                        
                        startTag = startTag.replace(/(<iframe|<frame)/,"$1 data-savepage-crossorigin=\"\"");
                        
                        if (element.src != "")
                        {
                            origurl = element.getAttribute("src");
                            
                            origstr = " data-savepage-src=\"" + origurl + "\"";
                            
                            startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"" + datauri + "\"");
                        }
                        else startTag = startTag.replace(/(<iframe|<frame)/,"$1 src=\"" + datauri + "\"");
                        
                        if (element.hasAttribute("srcdoc"))
                        {
                            origdoc = element.getAttribute("srcdoc");
                            
                            origstr = " data-savepage-srcdoc=\"" + origdoc + "\"";
                            
                            startTag = startTag.replace(/ srcdoc="[^"]*"/,origstr);
                        }
                    }
                }
            }
        }
        
        if (element.src != "")
        {
            if (datauri == null)
            {
                if (removeUnsavedURLs)
                {
                    origurl = element.getAttribute("src");
                    
                    origstr = " data-savepage-src=\"" + origurl + "\"";
                    
                    startTag = startTag.replace(/ src="[^"]*"/,origstr + " src=\"\"");
                }
            }
        }
        
        if (formatHTML && depth == 0 && !inline && parentpreserve == 0) htmlStrings[htmlStrings.length] = newlineIndent(indent);
        htmlStrings[htmlStrings.length] = startTag;
        
        if (element.localName == "iframe")
        {
            if (formatHTML && depth == 0 && !inline && parentpreserve == 0) htmlStrings[htmlStrings.length] = newlineIndent(indent);
            htmlStrings[htmlStrings.length] = endTag;
        }
    }
    else
    {
        if (element.localName == "html")
        {
            /* Add !DOCTYPE declaration */
            
            doctype = element.ownerDocument.doctype;
            
            if (doctype != null)
            {
                htmltext = '<!DOCTYPE ' + doctype.name + (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '') +
                           ((doctype.systemId && !doctype.publicId) ? ' SYSTEM' : '') + (doctype.systemId ? ' "' + doctype.systemId + '"' : '') + '>';
                
                htmlStrings[htmlStrings.length] = htmltext;
            }
        }
        
        if (startTag != "")
        {
            if (formatHTML && depth == 0 && !inline && parentpreserve == 0) htmlStrings[htmlStrings.length] = newlineIndent(indent);
            htmlStrings[htmlStrings.length] = startTag;
        }
        
        if (element.localName == "head")
        {
            /* Add <base> element to make relative URL's work in saved file */
            
            if (element.ownerDocument.head.querySelector("base") != null) target = element.ownerDocument.head.querySelector("base").target;
            else target = "";
            
            htmltext = "\n    <base href=\"" + element.ownerDocument.baseURI + "\"";
            if (target != "") htmltext += " target=\"" + target + "\"";
            htmltext += ">";
            
            htmlStrings[htmlStrings.length] = htmltext;
        }
        
        if (element.localName == "style" ||  /* style element */
            (element.localName == "script" && element.src == "") ||  /* <script> element */
            (element.localName == "link" && element.rel.toLowerCase() == "stylesheet" &&
             element.getAttribute("href") != "" && element.href != ""))  /* <link rel="stylesheet" href="..."> element */
        {
            if (formatHTML && depth == 0)
            {
                if (textContent.substr(-1) == "\n") textContent = textContent.substr(0,textContent.length-1);
                textContent = textContent.replace(/\n/g,newlineIndent(indent+2));
                textContent += newlineIndent(indent);
            }
            
            htmlStrings[htmlStrings.length] = textContent;
        }
        else if (element.localName == "textarea")  /* <textarea> element */
        {
            textContent = textContent.replace(/&/g,"&amp;");
            textContent = textContent.replace(/</g,"&lt;");
            textContent = textContent.replace(/>/g,"&gt;");
            
            htmlStrings[htmlStrings.length] = textContent;
        }
        else if (voidElements.indexOf(element.localName) >= 0) ;  /* void element */
        else
        {
            for (i = 0; i < element.childNodes.length; i++)
            {
                if (element.childNodes[i] != null)  /* in case web page not fully loaded before extracting */
                {
                    if (element.childNodes[i].nodeType == 1)  /* element node */
                    {
                        extractHTML(depth,frame,element.childNodes[i],crossorigin,nosource,preserve,indent+2);
                    }
                    else if (element.childNodes[i].nodeType == 3)  /* text node */
                    {
                        text = element.childNodes[i].textContent;
                        
                        if (element.localName != "noscript")
                        {
                            text = text.replace(/&/g,"&amp;");
                            text = text.replace(/</g,"&lt;");
                            text = text.replace(/>/g,"&gt;");
                        }
                        
                        if (formatHTML && depth == 0)
                        {
                            /* HTML whitespace == HTML space characters == spaces + newlines */
                            /* HTML spaces: space (U+0020), tab (U+0009), form feed (U+000C) */
                            /* HTML newlines: line feed (U+000A) or carriage return (U+000D) */
                            
                            if (preserve == 0) text = text.replace(/[\u0020\u0009\u000C\u000A\u000D]+/g," ");
                            else if (preserve == 1) text = text.replace(/[\u0020\u0009\u000C]+/g," ");
                        }
                        
                        htmlStrings[htmlStrings.length] = text;
                    }
                    else if (element.childNodes[i].nodeType == 8)  /* comment node */
                    {
                        text = element.childNodes[i].textContent;
                        
                        if (formatHTML && depth == 0 && !inline && preserve == 0)
                        {
                            text = text.replace(/\n/g,newlineIndent(indent+2));
                            
                            htmlStrings[htmlStrings.length] = newlineIndent(indent+2);
                        }
                        
                        htmlStrings[htmlStrings.length] = "<!--" + text + "-->";
                    }
                }
            }
        }
        
        if (element.localName == "head" && depth == 0)
        {
            /* Add favicon if missing */
            
            if (!iconFound)
            {
                baseuri = element.ownerDocument.baseURI;
                
                datauri = replaceURL("/favicon.ico",baseuri,crossorigin);
                
                htmltext = "\n    <link rel=\"icon\" href=\"" + datauri + "\">";
                
                htmlStrings[htmlStrings.length] = htmltext;
            }
            
            /* Add page loader script */
            
            if (usePageLoader && !savedPage)
            {
                pageLoaderText = pageLoaderText.substr(0,pageLoaderText.length-1);  /* remove final '}' */
                
                htmltext = "\n    <script id=\"savepage-pageloader\" type=\"application/javascript\">";
                htmltext += "\n      savepage_PageLoader(" + maxFrameDepth + ");";
                htmltext += "\n      " + pageLoaderText;
                for (i = 0; i < resourceLocation.length; i++) 
                {
                    if (resourceStatus[i] == "success" && resourceCharSet[i] == "" && resourceRemembered[i] > 1)  /* charset not defined - binary data */
                    {
                        htmltext += "\n        resourceMimeType[" + i + "] = \"" + resourceMimeType[i] + "\";";
                        htmltext += " resourceBase64Data[" + i + "] = \"" + btoa(resourceContent[i]) + "\";";
                    }
                }
                htmltext += "\n      }";  /* add final '}' */
                htmltext += "\n    </script>";
                
                htmlStrings[htmlStrings.length] = htmltext;
            }
            
            /* Add page info bar html, css and script */
            
            if (includeInfoBar)
            {
                date = new Date();
                
                pageInfoBarText = pageInfoBarText.replace(/%URL%/,document.URL);
                pageInfoBarText = pageInfoBarText.replace(/%DECODED-URL%/,decodeURIComponent(document.URL));
                pageInfoBarText = pageInfoBarText.replace(/%DATE%/,date.toDateString().substr(8,2) + " " + date.toDateString().substr(4,3) + " " + date.toDateString().substr(11,4));
                pageInfoBarText = pageInfoBarText.replace(/%TIME%/,date.toTimeString().substr(0,8));
                
                htmltext = "\n    <script id=\"savepage-pageinfo-bar-insert\" type=\"application/javascript\">";
                htmltext += "\n      window.addEventListener('load',function(event) {";
                htmltext += "\n        var pageinfobartext = '" + pageInfoBarText + "';";
                htmltext += "\n        var parser = new DOMParser();";
                htmltext += "\n        var pageinfodoc = parser.parseFromString(pageinfobartext,'text/html');";
                htmltext += "\n        var container = document.createElement('div');";
                htmltext += "\n        container.setAttribute('id','savepage-pageinfo-bar-container');";
                htmltext += "\n        document.documentElement.appendChild(container);";
                htmltext += "\n        container.appendChild(pageinfodoc.getElementById('savepage-pageinfo-bar-style'));";
                htmltext += "\n        container.appendChild(pageinfodoc.getElementById('savepage-pageinfo-bar-content'));";
                htmltext += "\n        document.getElementById('savepage-pageinfo-bar-button').addEventListener('click',function(event) {";
                htmltext += "\n          var container = document.getElementById('savepage-pageinfo-bar-container');";
                htmltext += "\n          document.documentElement.removeChild(container);";
                htmltext += "\n        },false);";
                htmltext += "\n        var script = document.getElementById('savepage-pageinfo-bar-insert');";
                htmltext += "\n        document.head.removeChild(script);";
                htmltext += "\n      },false);";
                htmltext += "\n    </script>";
                
                htmlStrings[htmlStrings.length] = htmltext;
            }
            
            /* Add saved page information */
            
            date = new Date();
            
            if (menuAction == 0)
            {
                state = "Basic Items;";
            }
            else if (menuAction == 1)
            {
                state = "Chosen Items;";
                if (saveHTMLImagesAll) state += " HTML image files (all);";
                if (saveHTMLAudioVideo) state += " HTML audio & video files;";
                if (saveHTMLObjectEmbed) state += " HTML object & embed files;";
                if (saveCSSImagesAll) state += " CSS image files (all);";
                if (saveCSSFontsWoff) state += " CSS font files (woff for any browser);";
                if (saveScripts) state += " Scripts (in same-origin frames);";
            }
            else if (menuAction == 2)
            {
                state = "Standard Items;";
            }
            
            if (usePageLoader && !savedPage) state += " Used page loader;";
            if (retainCrossFrames) state += " Retained cross-origin frames;";
            if (removeUnsavedURLs) state += " Removed unsaved URLs;";
            if (allowPassive) state += " Allowed passive mixed content;";
            if (refererHeader == 1) state += " Sent referer headers with origin only;";
            else if (refererHeader == 2) state += " Sent referer headers with origin and path;";
            state += " Max frame depth = " + maxFrameDepth + ";";
            state += " Max resource size = " + maxResourceSize + "MB;";
            state += " Max resource time = " + maxResourceTime + "s;";
            
            htmltext = "\n    <meta name=\"savepage-url\" content=\"" + decodeURIComponent(document.URL) + "\">";
            htmltext += "\n    <meta name=\"savepage-title\" content=\"" + document.title + "\">";
            htmltext += "\n    <meta name=\"savepage-date\" content=\"" + date.toString() + "\">";
            htmltext += "\n    <meta name=\"savepage-state\" content=\"" + state + "\">";
            
            htmlStrings[htmlStrings.length] = htmltext;
        }
        
        if (endTag != "")
        {
            if (formatHTML && depth == 0 && !inline && parentpreserve == 0 && element.children.length > 0) htmlStrings[htmlStrings.length] = newlineIndent(indent);
            htmlStrings[htmlStrings.length] = endTag;
        }
    }
}

function replaceCSSURLsInStyleSheet(csstext,baseuri,crossorigin)
{
    var regex;
    var matches = new Array();
    
    /* @import url() excluding existing data uri or */
    /* font or image url() excluding existing data uri or */
    /* avoid matches inside double-quote strings */
    /* avoid matches inside single-quote strings */
    /* avoid matches inside comments */
    
    regex = new RegExp(/(?:( ?)@import\s*(?:url\(\s*)?((?:"[^"]+")|(?:'[^']+')|(?:[^\s);]+))(?:\s*\))?\s*;)|/.source +  /* p1 & p2 */
                       /(?:( ?)url\(\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s)]+))\s*\))|/.source +  /* p3 & p4 */
                       /(?:"(?:\\"|[^"])*")|/.source +
                       /(?:'(?:\\'|[^'])*')|/.source +
                       /(?:\/\*(?:\*[^\/]|[^\*])*?\*\/)/.source,
                       "gi");
    
    csstext = csstext.replace(regex,_replaceCSSURLOrImportStyleSheet);
    
    return csstext;
    
    function _replaceCSSURLOrImportStyleSheet(match,p1,p2,p3,p4,offset,string)
    {
        var i,location,csstext,datauri,origstr;
        
        if (match.trim().substr(0,7).toLowerCase() == "@import")  /* @import url() */
        {
            p2 = removeQuotes(p2);
            
            if (!isSchemeDataOrMozExtension(p2))  /* exclude existing data uri or moz-extension url */
            {
                if (baseuri != null)
                {
                    location = resolveURL(p2,baseuri);
                    
                    if (location != null)
                    {
                        for (i = 0; i < resourceLocation.length; i++)
                            if (resourceLocation[i] == location && resourceStatus[i] == "success") break;
                        
                        if (i < resourceLocation.length)  /* style sheet found */
                        {
                            csstext = replaceCSSURLsInStyleSheet(resourceContent[i],resourceLocation[i],crossorigin);
                            
                            return p1 + "/*savepage-import-url=" + p2 + "*/" + p1 + csstext;
                        }
                    }
                }
                
                if (removeUnsavedURLs) return p1 + "/*savepage-import-url=" + p2 + "*/" + p1;
                else return match;  /* original @import rule */
            }
        }
        else if (match.trim().substr(0,4).toLowerCase() == "url(")  /* font or image url() */
        {
            p4 = removeQuotes(p4);
            
            if (!isSchemeDataOrMozExtension(p4))  /* exclude existing data uri or moz-extension url */
            {
                datauri = replaceURL(p4,baseuri,crossorigin);
                
                origstr = (datauri == p4) ? p3 : p3 + "/*savepage-url=" + p4 + "*/" + p3;
                
                return origstr + "url(" + datauri + ")";
            }
            else return match;  /* original data uri */ 
        }
        else if (match.substr(0,1) == "\"") return match;  /* double-quote string */
        else if (match.substr(0,1) == "'") return match;  /* single-quote string */
        else if (match.substr(0,2) == "/*") return match;  /* comment */
    }
}

function replaceCSSURLs(csstext,baseuri,crossorigin)
{
    var regex;
    
    regex = /( ?)url\(\s*((?:"[^"]+")|(?:'[^']+')|(?:[^\s)]+))\s*\)/gi;  /* image url() */
        
    csstext = csstext.replace(regex,_replaceCSSURL);
    
    return csstext;
    
    function _replaceCSSURL(match,p1,p2,offset,string)
    {
        var datauri,origstr;
        
        p2 = removeQuotes(p2);
        
        if (!isSchemeDataOrMozExtension(p2))  /* exclude existing data uri or moz-extension url */
        {
            datauri = replaceURL(p2,baseuri,crossorigin);
            
            origstr = (datauri == p2) ? p1 : p1 + "/*savepage-url=" + p2 + "*/" + p1;
            
            return origstr + "url(" + datauri + ")";
        }
        else return match;  /* original data uri */ 
    }
}

function replaceURL(url,baseuri,crossorigin)
{
    var i,location,count;
    
    if (savedPage) return url;  /* ignore new resources when re-saving */
    
    if (baseuri != null)
    {
        location = resolveURL(url,baseuri);
        
        if (location != null)
        {
            for (i = 0; i < resourceLocation.length; i++)
                if (resourceLocation[i] == location && resourceStatus[i] == "success") break;
            
            if (i < resourceLocation.length)
            {
                if (resourceCharSet[i] == "")  /* charset not defined - binary data */
                {
                    count = usePageLoader ? 1 : resourceRemembered[i];
                    
                    if (resourceContent[i].length*count*(4/3) > maxResourceSize*1024*1024)  /* skip large and/or repeated resource */  /* base64 expands by 4/3 */
                    {
                        if (removeUnsavedURLs) return "";  /* null string */
                        else return url;  /* original url */
                    }
                    
                    resourceReplaced[i]++;
                    
                    if (usePageLoader && !crossorigin && resourceRemembered[i] > 1)
                    {
                        return "data:" + resourceMimeType[i] + ";resource=" + i + ";base64,";  /* resource marker to be replaced by page loader */
                    }
                    else
                    {
                        return "data:" + resourceMimeType[i] + ";base64," + btoa(resourceContent[i]);  /* binary data encoded as Base64 ASCII string */
                    }
                }
                else  /* charset defined - character data */
                {
                    resourceReplaced[i]++;
                    
                    return "data:" + resourceMimeType[i] + ";charset=utf-8," + encodeURIComponent(resourceContent[i]);  /* characters encoded as UTF-8 %escaped string */
                }
            }
        }
    }
    
    if (removeUnsavedURLs) return "";  /* null string */
    else return url;  /* original url */
}

function swapScreenAndPrintDevices(csstext)
{
    var regex;
    
    regex = /@media[^{]*{/gi;  /* @media rule */
        
    csstext = csstext.replace(regex,_replaceDevice);
    
    return csstext;
    
    function _replaceDevice(match,offset,string)
    {
        match = match.replace(/screen/gi,"######");
        match = match.replace(/print/gi,"screen");
        match = match.replace(/######/gi,"print");
        
        return match;
    }
}

/************************************************************************/

/* Save utility functions */

function resolveURL(url,baseuri)
{
    var resolvedURL;
    
    try
    {
        resolvedURL = new URL(url,baseuri);
    }
    catch (e)
    {
        return null;  /* baseuri invalid or null */
    }
    
    return resolvedURL.href;
}

function removeQuotes(url)
{
    if (url.substr(0,1) == "\"" || url.substr(0,1) == "'") url = url.substr(1);
    
    if (url.substr(-1) == "\"" || url.substr(-1) == "'") url = url.substr(0,url.length-1);
    
    return url;
}

function isSchemeDataOrMozExtension(url)
{
    /* Exclude existing data uri or moz-extension url */
    
    if (url.substr(0,5).toLowerCase() == "data:" || url.substr(0,14).toLowerCase() == "moz-extension:") return true;

    return false;
}

function convertUTF8ToUTF16(utf8str)
{
    var i,byte1,byte2,byte3,byte4,codepoint,utf16str;
    
    /* Convert UTF-8 string to Javascript UTF-16 string */
    /* Each codepoint in UTF-8 string comprises one to four 8-bit values */
    /* Each codepoint in UTF-16 string comprises one or two 16-bit values */
    
    i = 0;
    utf16str = "";
    
    while (i < utf8str.length)
    {
        byte1 = utf8str.charCodeAt(i++);
        
        if ((byte1 & 0x80) == 0x00)
        {
            utf16str += String.fromCharCode(byte1);  /* one 16-bit value */
        }
        else if ((byte1 & 0xE0) == 0xC0)
        {
            byte2 = utf8str.charCodeAt(i++);
            
            codepoint = ((byte1 & 0x1F) << 6) + (byte2 & 0x3F);
            
            utf16str += String.fromCodePoint(codepoint);  /* one 16-bit value */
        }
        else if ((byte1 & 0xF0) == 0xE0)
        {
            byte2 = utf8str.charCodeAt(i++);
            byte3 = utf8str.charCodeAt(i++);
            
            codepoint = ((byte1 & 0x0F) << 12) + ((byte2 & 0x3F) << 6) + (byte3 & 0x3F);
            
            utf16str += String.fromCodePoint(codepoint);  /* one 16-bit value */
        }
        else if ((byte1 & 0xF8) == 0xF0)
        {
            byte2 = utf8str.charCodeAt(i++);
            byte3 = utf8str.charCodeAt(i++);
            byte4 = utf8str.charCodeAt(i++);
            
            codepoint = ((byte1 & 0x07) << 18) + ((byte2 & 0x3F) << 12) + ((byte3 & 0x3F) << 6) + (byte4 & 0x3F);
            
            utf16str += String.fromCodePoint(codepoint);  /* two 16-bit values */
        }
    }
    
    return utf16str;
}

function newlineIndent(indent)
{
    var i,str;
    
    str = "\n";
    
    for (i = 0; i < indent; i++) str += " ";
    
    return str;
}

function getSavedFileName(url,title,extract)
{
    var i,documentURL,host,lastsegment,file,extension,path,datestr,filename;
    var pathsegments = new Array();
    var date = new Date();
    
    documentURL = new URL(url);
    
    host = documentURL.hostname;
    host = decodeURIComponent(host);
    host = sanitizeString(host);
    
    pathsegments = documentURL.pathname.split("/");
    lastsegment = pathsegments.pop();
    if (lastsegment == "") lastsegment = pathsegments.pop();
    lastsegment = decodeURIComponent(lastsegment);
    lastsegment = sanitizeString(lastsegment);
    
    i = lastsegment.lastIndexOf(".");
    
    if (i < 0)
    {
        file = lastsegment;
        extension = "";
    }
    else
    {
        file = lastsegment.substring(0,i);
        extension = lastsegment.substring(i);
    }
    
    if (!extract) extension = ".html";
    
    pathsegments.shift();
    pathsegments.push(file);
    path = pathsegments.join("/");
    path = decodeURIComponent(path);
    path = sanitizeString(path);
    
    title = sanitizeString(title);
    title = title.trim();
    
    if (title == "") title = file;
    
    datestr = new Date(date.getTime()-(date.getTimezoneOffset()*60000)).toISOString();
    
    filename = savedFileName;
    
    filename = filename.replace(/%TITLE%/g,title);
    filename = filename.replace(/%DATE%/g,datestr.substr(0,10));
    filename = filename.replace(/%TIME%/g,datestr.substr(11,8).replace(/:/g,"-"));
    filename = filename.replace(/%HOST%/g,host);
    filename = filename.replace(/%PATH%/g,path);
    filename = filename.replace(/%FILE%/g,file);
    
    filename = filename.replace(/(\\|\/|:|\*|\?|"|<|>|\|)/g,"_");
    
    if (replaceSpaces) filename = filename.replace(/\s/g,replaceChar);
    
    filename = filename + extension;
    
    return filename;
}

function sanitizeString(string)
{
    var i,charcode;
    
    /* Remove control characters: 0-31 and 255 */ 
    /* Remove other line break characters: 133, 8232, 8233 */ 
    /* Remove zero-width characters: 6158, 8203, 8204, 8205, 8288, 65279 */ 
    /* Change all space characters to normal spaces: 160, 5760, 8192-8202, 8239, 8287, 12288 */
    /* Change all hyphen characters to normal hyphens: 173, 1470, 6150, 8208-8213, 8315, 8331, 8722, 11834, 11835, 65112, 65123, 65293 */
    
    for (i = 0; i < string.length; i++)
    {
        charcode = string.charCodeAt(i);
        
        if (charcode <= 31 || charcode == 255 ||
            charcode == 133 || charcode == 8232 || charcode == 8233 ||
            charcode == 6158 || charcode == 8203 || charcode == 8204 || charcode == 8205 || charcode == 8288 || charcode == 65279)
        {
            string = string.substr(0,i) + string.substr(i+1);
        }
        
        if (charcode == 160 || charcode == 5760 || (charcode >= 8192 && charcode <= 8202) || charcode == 8239 || charcode == 8287 || charcode == 12288)
        {
            string = string.substr(0,i) + " " + string.substr(i+1);
        }
        
        if (charcode == 173 || charcode == 1470 || charcode == 6150 || (charcode >= 8208 && charcode <= 8213) ||
            charcode == 8315 || charcode == 8331 || charcode == 8722 || charcode == 11834 || charcode == 11835 ||
            charcode == 65112 || charcode == 65123 || charcode == 65293)
        {
            string = string.substr(0,i) + "-" + string.substr(i+1);
        }
    }
    
    return string;
}
