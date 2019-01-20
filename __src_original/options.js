/************************************************************************/
/*                                                                      */
/*      Save Page WE - Generic WebExtension - Options Page              */
/*                                                                      */
/*      Javascript for Options Page                                     */
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
/*  https://developer.chrome.com/extensions/optionsV2                   */
/*                                                                      */
/*  https://developer.chrome.com/extensions/storage                     */
/*                                                                      */
/************************************************************************/

"use strict";

/************************************************************************/

/* Global variables */

var isFirefox;
var ffVersion;

/************************************************************************/

/* Listener for options page load */

document.addEventListener("DOMContentLoaded",onLoadPage,false);

/************************************************************************/

/* Initialize on page load */

function onLoadPage(event)
{
    /* Load options from local storage */
    
    chrome.storage.local.get(null,
    function(object)
    {
        /* Load environment */
        
        isFirefox = object["environment-isfirefox"];
        
        if (isFirefox) ffVersion = object["environment-ffversion"];
        
        if (isFirefox && ffVersion >= 60) document.body.setAttribute("shortcuts","");
	    
        /* General options */
        
        document.getElementById("options-buttonaction").elements["action"].value = object["options-buttonaction"];
        
        document.getElementById("options-showsubmenu").checked = object["options-showsubmenu"];
        document.getElementById("options-showwarning").checked = object["options-showwarning"];
        document.getElementById("options-showurllist").checked = object["options-showurllist"];
        document.getElementById("options-promptcomments").checked = object["options-promptcomments"];
        
        document.getElementById("options-usepageloader").checked = object["options-usepageloader"];
        document.getElementById("options-retaincrossframes").checked = object["options-retaincrossframes"];
        document.getElementById("options-removeunsavedurls").checked = object["options-removeunsavedurls"];
        document.getElementById("options-includeinfobar").checked = object["options-includeinfobar"];
        document.getElementById("options-includesummary").checked = object["options-includesummary"];
        document.getElementById("options-formathtml").checked = object["options-formathtml"];
        
        document.getElementById("options-savedfilename").value = object["options-savedfilename"];
        document.getElementById("options-replacespaces").checked = object["options-replacespaces"];
        document.getElementById("options-replacechar").value = object["options-replacechar"];
        
        document.getElementById("options-replacechar").disabled = !document.getElementById("options-replacespaces").checked;
        
        /* Saved Items options */
        
        document.getElementById("options-savehtmlaudiovideo").checked = object["options-savehtmlaudiovideo"];
        document.getElementById("options-savehtmlobjectembed").checked = object["options-savehtmlobjectembed"];
        document.getElementById("options-savehtmlimagesall").checked = object["options-savehtmlimagesall"];
        document.getElementById("options-savecssimagesall").checked = object["options-savecssimagesall"];
        document.getElementById("options-savecssfontswoff").checked = object["options-savecssfontswoff"];
        document.getElementById("options-savescripts").checked = object["options-savescripts"];
        
        /* Advanced options */
        
        document.getElementById("options-maxframedepth").value = object["options-maxframedepth"];
        document.getElementById("options-maxresourcesize").value = object["options-maxresourcesize"];
        document.getElementById("options-maxresourcetime").value = object["options-maxresourcetime"];
        document.getElementById("options-allowpassive").checked = object["options-allowpassive"];
        document.getElementById("options-refererheader").elements["header"].value = object["options-refererheader"];
        
        /* Keyboard shortcuts */
        
        if (isFirefox && ffVersion >= 60)
        {
            chrome.commands.getAll(
            function(commands)
            {
                var i;
                
                for (i = 0; i < commands.length; i++)
                {
                    if (commands[i].name == "_execute_browser_action") document.getElementById("options-shortcuts-browseraction").value = commands[i].shortcut;
                }
            });
        }
    });
    
    /* Add listeners for click on tab buttons */
    
    document.getElementById("options-tabbar-general").addEventListener("click",showGeneralTab,false);
    document.getElementById("options-tabbar-saveditems").addEventListener("click",showSavedItemsTab,false);
    document.getElementById("options-tabbar-advanced").addEventListener("click",showAdvancedTab,false);
    document.getElementById("options-tabbar-shortcuts").addEventListener("click",showShortcutsTab,false);
    
    /* Add listeners for click on replace spaces checkbox */
    
    document.getElementById("options-replacespaces").addEventListener("click",onClickReplaceSpaces,false);
    
    /* Add listener for click on save button */
    
    document.getElementById("options-save-button").addEventListener("click",onClickSave,false);
    
    /* Add listener for click on reset all button */
    
    document.getElementById("options-resetall-button").addEventListener("click",onClickResetAll,false);
    
    /* Wait for page layout to complete */
    
    document.getElementById("options").style.setProperty("opacity","0","");
    
    window.setTimeout(
    function()
    {
        var width1,width2,width3,width4,height1,height2,height3,height4;
        
        /* Equalize widths of tabs */
        
        width1 = window.getComputedStyle(document.getElementById("options-tab-general"),null).getPropertyValue("width");
        width2 = window.getComputedStyle(document.getElementById("options-tab-saveditems"),null).getPropertyValue("width");
        width3 = window.getComputedStyle(document.getElementById("options-tab-advanced"),null).getPropertyValue("width");
        width4 = window.getComputedStyle(document.getElementById("options-tab-shortcuts"),null).getPropertyValue("width");
        
        width1 = width1.substr(0,width1.length-2);
        width2 = width2.substr(0,width2.length-2);
        width3 = width3.substr(0,width3.length-2);
        width4 = width4.substr(0,width4.length-2);
        
        width1 = Math.max(width1,width2,width3,width4);
        
        document.getElementById("options-tab-general").style.setProperty("width",width1 + "px","");
        document.getElementById("options-tab-saveditems").style.setProperty("width",width1 + "px","");
        document.getElementById("options-tab-advanced").style.setProperty("width",width1 + "px","");
        document.getElementById("options-tab-shortcuts").style.setProperty("width",width1 + "px","");
        
        /* Equalize heights of tabs */
        
        height1 = window.getComputedStyle(document.getElementById("options-tab-general"),null).getPropertyValue("height");
        height2 = window.getComputedStyle(document.getElementById("options-tab-saveditems"),null).getPropertyValue("height");
        height3 = window.getComputedStyle(document.getElementById("options-tab-advanced"),null).getPropertyValue("height");
        height4 = window.getComputedStyle(document.getElementById("options-tab-shortcuts"),null).getPropertyValue("height");
        
        height1 = height1.substr(0,height1.length-2);
        height2 = height2.substr(0,height2.length-2);
        height3 = height3.substr(0,height3.length-2);
        height4 = height4.substr(0,height4.length-2);
        
        height1 = Math.max(height1,height2,height3,height4);
        
        document.getElementById("options-tab-general").style.setProperty("height",height1 + "px","");
        document.getElementById("options-tab-saveditems").style.setProperty("height",height1 + "px","");
        document.getElementById("options-tab-advanced").style.setProperty("height",height1 + "px","");
        document.getElementById("options-tab-shortcuts").style.setProperty("height",height1 + "px","");
        
        /* Show general tab */
        
        showGeneralTab();
        
        document.getElementById("options").style.setProperty("opacity","1","");
    },50);
}

/************************************************************************/

/* Select tab */

function showGeneralTab(event)
{
    document.getElementById("options-tabbar-general").setAttribute("selected","");
    document.getElementById("options-tabbar-saveditems").removeAttribute("selected");
    document.getElementById("options-tabbar-advanced").removeAttribute("selected");
    document.getElementById("options-tabbar-shortcuts").removeAttribute("selected");
    
    document.getElementById("options-tab-general").style.setProperty("display","block","");
    document.getElementById("options-tab-saveditems").style.setProperty("display","none","");
    document.getElementById("options-tab-advanced").style.setProperty("display","none","");
    document.getElementById("options-tab-shortcuts").style.setProperty("display","none","");
}

function showSavedItemsTab(event)
{
    document.getElementById("options-tabbar-general").removeAttribute("selected");
    document.getElementById("options-tabbar-saveditems").setAttribute("selected","");
    document.getElementById("options-tabbar-advanced").removeAttribute("selected");
    document.getElementById("options-tabbar-shortcuts").removeAttribute("selected");
    
    document.getElementById("options-tab-general").style.setProperty("display","none","");
    document.getElementById("options-tab-saveditems").style.setProperty("display","block","");
    document.getElementById("options-tab-advanced").style.setProperty("display","none","");
    document.getElementById("options-tab-shortcuts").style.setProperty("display","none","");
}

function showAdvancedTab(event)
{
    document.getElementById("options-tabbar-general").removeAttribute("selected");
    document.getElementById("options-tabbar-saveditems").removeAttribute("selected");
    document.getElementById("options-tabbar-advanced").setAttribute("selected","");
    document.getElementById("options-tabbar-shortcuts").removeAttribute("selected");
    
    document.getElementById("options-tab-general").style.setProperty("display","none","");
    document.getElementById("options-tab-saveditems").style.setProperty("display","none","");
    document.getElementById("options-tab-advanced").style.setProperty("display","block","");
    document.getElementById("options-tab-shortcuts").style.setProperty("display","none","");
}

function showShortcutsTab(event)
{
    document.getElementById("options-tabbar-general").removeAttribute("selected");
    document.getElementById("options-tabbar-saveditems").removeAttribute("selected");
    document.getElementById("options-tabbar-advanced").removeAttribute("selected");
    document.getElementById("options-tabbar-shortcuts").setAttribute("selected","");
    
    document.getElementById("options-tab-general").style.setProperty("display","none","");
    document.getElementById("options-tab-saveditems").style.setProperty("display","none","");
    document.getElementById("options-tab-advanced").style.setProperty("display","none","");
    document.getElementById("options-tab-shortcuts").style.setProperty("display","block","");
}

/************************************************************************/

/* Enable or Disable options */

function onClickReplaceSpaces(event)
{
    document.getElementById("options-replacechar").disabled = !document.getElementById("options-replacespaces").checked;
}

/************************************************************************/

/* Save options */

function onClickSave(event)
{
    /* Validate saved file name */
    
    if (document.getElementById("options-savedfilename").value == "")
        document.getElementById("options-savedfilename").value = "%TITLE%";
    
    if (document.getElementById("options-replacechar").value == "")
        document.getElementById("options-replacechar").value = "-";
    
    /* Save options to local storage */
    
    chrome.storage.local.set(
    {
        /* General options */
        
        "options-buttonaction": +document.getElementById("options-buttonaction").elements["action"].value,
        
        "options-showsubmenu": document.getElementById("options-showsubmenu").checked,
        "options-showwarning": document.getElementById("options-showwarning").checked,
        "options-showurllist": document.getElementById("options-showurllist").checked,
        "options-promptcomments": document.getElementById("options-promptcomments").checked,
        
        "options-usepageloader": document.getElementById("options-usepageloader").checked,
        "options-retaincrossframes": document.getElementById("options-retaincrossframes").checked,
        "options-removeunsavedurls": document.getElementById("options-removeunsavedurls").checked,
        "options-includeinfobar": document.getElementById("options-includeinfobar").checked,
        "options-includesummary": document.getElementById("options-includesummary").checked,
        "options-formathtml": document.getElementById("options-formathtml").checked,
        
        "options-savedfilename": document.getElementById("options-savedfilename").value,
        "options-replacespaces": document.getElementById("options-replacespaces").checked,
        "options-replacechar": document.getElementById("options-replacechar").value,
        
        /* Saved Items options */
        
        "options-savehtmlaudiovideo": document.getElementById("options-savehtmlaudiovideo").checked,
        "options-savehtmlobjectembed": document.getElementById("options-savehtmlobjectembed").checked,
        "options-savehtmlimagesall": document.getElementById("options-savehtmlimagesall").checked,
        "options-savecssimagesall": document.getElementById("options-savecssimagesall").checked,
        "options-savecssfontswoff": document.getElementById("options-savecssfontswoff").checked,
        "options-savescripts": document.getElementById("options-savescripts").checked,
        
        /* Advanced options */
        
        "options-maxframedepth": +document.getElementById("options-maxframedepth").value,
        "options-maxresourcesize": +document.getElementById("options-maxresourcesize").value,
        "options-maxresourcetime": +document.getElementById("options-maxresourcetime").value,
        "options-allowpassive": document.getElementById("options-allowpassive").checked,
        "options-refererheader": +document.getElementById("options-refererheader").elements["header"].value
    });
    
    /* Keyboard shortcuts */
    
    if (isFirefox && ffVersion >= 60)
    {
        try
        {
            chrome.commands.update({ name: "_execute_browser_action", shortcut: document.getElementById("options-shortcuts-browseraction").value });
        }
        catch (e)
        {
            chrome.commands.reset("_execute_browser_action");
            document.getElementById("options-shortcuts-browseraction").value = "Alt+A";
        }
    }
    
    /* Display saved status for short period */
    
    document.getElementById("options-save-button").innerText = "Saved";
    document.getElementById("options-save-button").style.setProperty("font-weight","bold","");
    
    setTimeout(function()
    {
        document.getElementById("options-save-button").innerText = "Save";
        document.getElementById("options-save-button").style.setProperty("font-weight","normal","");
    }
    ,1000);
}

/************************************************************************/

/* Reset All options */

function onClickResetAll(event)
{
    /* General options */
    
    document.getElementById("options-buttonaction").elements["action"].value = 2;
    
    document.getElementById("options-showsubmenu").checked = true;
    document.getElementById("options-showwarning").checked = true;
    document.getElementById("options-showurllist").checked = false;
    document.getElementById("options-promptcomments").checked = false;
    
    document.getElementById("options-usepageloader").checked = true;
    document.getElementById("options-retaincrossframes").checked = true;
    document.getElementById("options-removeunsavedurls").checked = true;
    document.getElementById("options-includeinfobar").checked = false;
    document.getElementById("options-includesummary").checked = false;
    document.getElementById("options-formathtml").checked = false;
    
    document.getElementById("options-savedfilename").value = "%TITLE%";
    document.getElementById("options-replacespaces").checked = false;
    document.getElementById("options-replacechar").value = "-";
    
    document.getElementById("options-replacechar").disabled = true;
    
    /* Saved Items options */
    
    document.getElementById("options-savehtmlaudiovideo").checked = false;
    document.getElementById("options-savehtmlobjectembed").checked = false;
    document.getElementById("options-savehtmlimagesall").checked = false;
    document.getElementById("options-savecssimagesall").checked = false;
    document.getElementById("options-savecssfontswoff").checked = false;
    document.getElementById("options-savescripts").checked = false;
    
    /* Advanced options */
    
    document.getElementById("options-maxframedepth").value = 5;
    document.getElementById("options-maxresourcesize").value = 50;
    document.getElementById("options-maxresourcetime").value = 10;
    document.getElementById("options-allowpassive").checked = false;
    document.getElementById("options-refererheader").elements["header"].value = 0;
        
    /* Keyboard shortcuts */
    
    if (isFirefox && ffVersion >= 60)
    {
        document.getElementById("options-shortcuts-browseraction").value = "Alt+A";
    }
    
    /* Display reset status for short period */
    
    document.getElementById("options-resetall-button").innerText = "Reset";
    document.getElementById("options-resetall-button").style.setProperty("font-weight","bold","");
    
    setTimeout(function()
    {
        document.getElementById("options-resetall-button").innerText = "Reset All";
        document.getElementById("options-resetall-button").style.setProperty("font-weight","normal","");
    }
    ,1000);
}

/************************************************************************/
