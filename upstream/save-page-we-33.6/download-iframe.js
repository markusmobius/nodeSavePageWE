/************************************************************************/
/*                                                                      */
/*      Save Page WE - Generic WebExtension - Download Iframe           */
/*                                                                      */
/*      Javascript for Downloading Saved Page (injected iframe)         */
/*                                                                      */
/*      Last Edit - 01 Oct 2022                                         */
/*                                                                      */
/*      Copyright (C) 2022 DW-dev                                       */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*      See LICENCE.txt file and http://www.gnu.org/licenses/           */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Refer to Google Chrome developer documentation:                      */
/*                                                                      */
/* developer.chrome.com/docs/extensions/mv3/content_scripts             */
/* developer.chrome.com/docs/extensions/mv3/messaging                   */
/*                                                                      */
/* developer.chrome.com/docs/extensions/mv3/match_patterns              */
/*                                                                      */
/* developer.chrome.com/docs/extensions/reference/downloads             */
/* developer.chrome.com/docs/extensions/reference/runtime               */
/*                                                                      */
/************************************************************************/

"use strict";

/************************************************************************/

/* Global variables */

var isFirefox,showSaveAsDialog;

var tabId;

var htmlStrings = [];

/************************************************************************/

/* Initialize */

chrome.storage.local.get(null,
function(local)
{
    /* Load environment */
    
    isFirefox = local["environment-isfirefox"];
    
    /* Load options */
    
    showSaveAsDialog = local["options-showsaveasdialog"]
    
    /* Get tab identifier */
    
    chrome.runtime.sendMessage({ type: "getTabId" },
    function(response)
    {
        tabId = response.tabid;
    });
});

/************************************************************************/

/* Add listeners */

/* Storage changed listener */

chrome.storage.onChanged.addListener(
function(changes,areaName)
{
    if ("options-showsaveasdialog" in changes) showSaveAsDialog = changes["options-showsaveasdialog"].newValue;
});

/* Message received listener */

chrome.runtime.onMessage.addListener(
function(message,sender,sendResponse)
{
    var htmlBlob,objectURL,link;
    
    switch (message.type)
    {
        /* Messages from content script */
        
        case "transferString":
            
            if (sender.tab.id == tabId)  /* check message is from content script in same tab as iframe */
            {
                if (message.htmlindex == 0) htmlStrings.length = 0;
                
                htmlStrings[message.htmlindex] = message.htmlstring;
            }
            
            break;
            
        case "savePage":
            
            if (sender.tab.id == tabId)  /* check message is from content script in same tab as iframe */
            {
                /* Convert html strings to html blob */
                
                htmlBlob = new Blob(htmlStrings, { type : "text/html" });
                
                objectURL = window.URL.createObjectURL(htmlBlob);
                
                htmlBlob = null;
                
                htmlStrings.length = 0;
                
                /* Save page using chrome.downloads.download() */
                
                chrome.downloads.onChanged.addListener(onChangedCallback);
                
                function onChangedCallback(downloadDelta)
                {
                    if (downloadDelta.error && downloadDelta.error.current == "USER_CANCELED")  /* Chrome */
                    {
                        downloadDone(false);
                    }
                    else if (downloadDelta.state && downloadDelta.state.current == "interrupted")
                    {
                        downloadDone(false);
                    }
                    else if (downloadDelta.state && downloadDelta.state.current == "complete")
                    {
                        downloadDone(true);
                    }
                }
                
                if (isFirefox)
                {
                    chrome.downloads.download({ url: objectURL, filename: message.filename, saveAs: showSaveAsDialog ? true : null, incognito: message.incognito },
                    function(downloadItemId)
                    {
                        if (chrome.runtime.lastError != null && chrome.runtime.lastError.message == "Download canceled by the user")  /* Firefox */
                        {
                            downloadDone(false);
                        }
                    });
                }
                else chrome.downloads.download({ url: objectURL, filename: message.filename, saveAs: showSaveAsDialog ? true : null });
                
                function downloadDone(success)
                {
                    chrome.downloads.onChanged.removeListener(onChangedCallback);
                    
                    window.URL.revokeObjectURL(objectURL);
                    
                    chrome.tabs.sendMessage(sender.tab.id,{ type: "saveResult", success: success });
                }
            }
            
            break;
    }
});

