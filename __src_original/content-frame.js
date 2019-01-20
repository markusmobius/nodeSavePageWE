/************************************************************************/
/*                                                                      */
/*      Save Page WE - Generic WebExtension - Content Pages             */
/*                                                                      */
/*      Javascript for Saving Content Pages (all frames)                */
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
/* Refer to Google Chrome developer documentation:                      */
/*                                                                      */
/*  https://developer.chrome.com/extensions/content_scripts             */
/*  https://developer.chrome.com/extensions/messaging                   */
/*                                                                      */
/*  https://developer.chrome.com/extensions/match_patterns              */
/*                                                                      */
/*  https://developer.chrome.com/extensions/runtime                     */
/*  https://developer.chrome.com/extensions/storage                     */
/*                                                                      */
/************************************************************************/

/* Loaded into all frames (including iframes) of all content pages */

/* Shares global variable/function namespace with other content scripts */

/* Use wrapper function to separate namespace from main content script */

"use strict";

frameScript();

function frameScript()
{

/************************************************************************/

/* Global variables */

/************************************************************************/

/* Initialize on script load */

if (document.readyState != "loading") onLoadPage();
else
{
    window.addEventListener("load",
    function(event)
    {
        if (document.readyState != "loading") onLoadPage();
    },false);
}

/************************************************************************/

/* Initialize on page load */

function onLoadPage()
{
    /* Add listeners */
    
    addListeners();
}

/************************************************************************/

/* Add listeners */

function addListeners()
{
    /* Message received listener */
    
    chrome.runtime.onMessage.addListener(
    function(message,sender,sendResponse)
    {
        var doctype,htmltext;
        var loadedfonts = new Array();
        
        switch (message.type)
        {
            /* Messages from background page */
                
            case "requestCrossFrames":
                
                if (document.defaultView.frameElement == null)  /* cross-origin */
                {
                    nameCrossFrames(0,window,document.documentElement);
                    
                    if (window.name != "")
                    {
                        document.fonts.forEach(  /* CSS Font Loading Module */
                        function(font)
                        {
                            if (font.status == "loaded")  /* font is being used in this document */
                            {
                                loadedfonts.push({ family: font.family, weight: font.weight, style: font.style, stretch: font.stretch });
                            }
                        });
                        
                        doctype = document.doctype;
                        
                        if (doctype != null)
                        {
                            htmltext = '<!DOCTYPE ' + doctype.name + (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '') +
                                       ((doctype.systemId && !doctype.publicId) ? ' SYSTEM' : '') + (doctype.systemId ? ' "' + doctype.systemId + '"' : '') + '>';
                        }
                        else htmltext = "";
                        
                        htmltext += document.documentElement.outerHTML;
                        
                        htmltext = htmltext.replace(/<head([^>]*)>/,"<head$1><base href=\"" + document.baseURI + "\">");
                        
                        chrome.runtime.sendMessage({ type: "replyCrossFrame", name: window.name, url: document.baseURI, html: htmltext, fonts: loadedfonts });
                    }
                }
                
                break;
        }
    });
}

/************************************************************************/

/* Pre Pass - to identify and name cross-origin frames */

function nameCrossFrames(depth,frame,element)
{
    var i;
    
    /* Handle nested frames and child elements */
    
    if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */
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
            if (!element.name) element.setAttribute("name","savepage-frame-" + Math.trunc(Math.random()*1000000000));
            
            // console.log("Frame - Cross - " + depth + " - " + (element.name + "                         ").substr(0,25) + " - "
                                           // + (element.src + "                                                            ").replace(/\:/g,"").substr(0,80));  /*???*/
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

}
