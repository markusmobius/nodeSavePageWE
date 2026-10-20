/************************************************************************/
/*                                                                      */
/*      Save Page WE - Generic WebExtension - Options Page              */
/*                                                                      */
/*      Javascript for Options Page                                     */
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
/* developer.chrome.com/docs/extensions/mv3/options                     */
/*                                                                      */
/* developer.chrome.com/docs/extensions/reference/commands              */
/* developer.chrome.com/docs/extensions/reference/storage               */
/*                                                                      */
/************************************************************************/

"use strict";

/************************************************************************/

/* Global variables */

var isFirefox;

var platformOS;

/************************************************************************/

/* Listener for options page load */

document.addEventListener("DOMContentLoaded",onLoadPage,false);

/************************************************************************/

/* Initialize on page load */

function onLoadPage(event)
{
    /* Load options from local storage */
    
    chrome.storage.local.get(null,
    function(local)
    {
        var label;
        var title1 = "The alternative save method is able to save some\npages that the default save method cannot save";
        var title2 = "but does not remember the last save location if \nit is outside Chrome's default downloads folder.";
        
        /* Load environment */
        
        isFirefox = local["environment-isfirefox"];
        
        platformOS = local["environment-platformos"];
        
        if (isFirefox) document.body.setAttribute("isfirefox","");
	    
        if (isFirefox) document.body.setAttribute("shortcuts","");
	    
        if (platformOS == "win") document.body.setAttribute("windows","");
        
        label = document.getElementById("options-usenewsavemethod").nextElementSibling;
        if (isFirefox) label.setAttribute("title",title1 + ".");
        else label.setAttribute("title",title1 + ",\n" + title2);
        
        /* General options */
        
        document.getElementById("options-buttonaction").elements["type"].value = local["options-buttonactiontype"];
        document.getElementById("options-buttonaction").elements["items"].value = local["options-buttonactionitems"];
        
        document.getElementById("options-showsubmenu").checked = local["options-showsubmenu"];
        document.getElementById("options-showwarning").checked = local["options-showwarning"];
        document.getElementById("options-showresources").checked = local["options-showresources"];
        document.getElementById("options-promptcomments").checked = local["options-promptcomments"];
        document.getElementById("options-skipwarningscomments").checked = local["options-skipwarningscomments"];
        document.getElementById("options-usenewsavemethod").checked = local["options-usenewsavemethod"];
        document.getElementById("options-showsaveasdialog").checked = local["options-showsaveasdialog"];
        document.getElementById("options-closetabafter").checked = local["options-closetabafter"];
        
        document.getElementById("options-loadlazycontent").checked = local["options-loadlazycontent"];
        document.getElementById("options-lazyloadtype").value = local["options-lazyloadtype"];
        document.getElementById("options-loadlazyimages").checked = local["options-loadlazyimages"];
        document.getElementById("options-retaincrossframes").checked = local["options-retaincrossframes"];
        document.getElementById("options-mergecssimages").checked = local["options-mergecssimages"];
        document.getElementById("options-executescripts").checked = local["options-executescripts"];
        document.getElementById("options-removeunsavedurls").checked = local["options-removeunsavedurls"];
        document.getElementById("options-removeelements").checked = local["options-removeelements"];
        document.getElementById("options-rehideelements").checked = local["options-rehideelements"];
        document.getElementById("options-includeinfobar").checked = local["options-includeinfobar"];
        document.getElementById("options-includesummary").checked = local["options-includesummary"];
        document.getElementById("options-formathtml").checked = local["options-formathtml"];
        
        document.getElementById("options-skipwarningscomments").disabled = !(document.getElementById("options-showwarning").checked ||
                                                                             document.getElementById("options-showresources").checked ||
                                                                             document.getElementById("options-promptcomments").checked);
        
        document.getElementById("options-showsaveasdialog").disabled = !document.getElementById("options-usenewsavemethod").checked;
        
        document.getElementById("options-rehideelements").disabled = document.getElementById("options-removeelements").checked;
        
        /* Saved Items options */
        
        document.getElementById("options-savehtmlimagesall").checked = local["options-savehtmlimagesall"];
        document.getElementById("options-savehtmlaudiovideo").checked = local["options-savehtmlaudiovideo"];
        document.getElementById("options-savehtmlobjectembed").checked = local["options-savehtmlobjectembed"];
        document.getElementById("options-savecssimagesall").checked = local["options-savecssimagesall"];
        document.getElementById("options-savecssfontswoff").checked = local["options-savecssfontswoff"];
        document.getElementById("options-savecssfontsall").checked = local["options-savecssfontsall"];
        document.getElementById("options-savescripts").checked = local["options-savescripts"];
        
        document.getElementById("options-savecssfontswoff").disabled = document.getElementById("options-savecssfontsall").checked;
        
        /* File Info options */
        
        document.getElementById("options-urllistname").textContent = local["options-urllistname"];
        document.getElementById("options-urllistsize").textContent = local["options-urllisturls"].length + " URLs Listed";
        
        document.getElementById("options-savedfilename").value = local["options-savedfilename"];
        document.getElementById("options-replacespaces").checked = local["options-replacespaces"];
        document.getElementById("options-replacechar").value = local["options-replacechar"];
        document.getElementById("options-maxfilenamelength").value = local["options-maxfilenamelength"];
        
        document.getElementById("options-replacechar").disabled = !document.getElementById("options-replacespaces").checked;
        
        if (local["options-urllistname"] == "")
        {
            document.getElementById("options-urllistclear").disabled = true;
            document.getElementById("options-urllistsize").style.setProperty("visibility","hidden","");
        }
        
        /* Advanced options */
        
        document.getElementById("options-maxpagetime").value = local["options-maxpagetime"];
        
        document.getElementById("options-savedelaytime").value = local["options-savedelaytime"];
        
        document.getElementById("options-lazyloadscrolltime").value = local["options-lazyloadscrolltime"];
        document.getElementById("options-lazyloadshrinktime").value = local["options-lazyloadshrinktime"];
        
        document.getElementById("options-maxframedepth").value = local["options-maxframedepth"];
        
        document.getElementById("options-maxresourcesize").value = local["options-maxresourcesize"];
        
        document.getElementById("options-maxresourcetime").value = local["options-maxresourcetime"];
        
        document.getElementById("options-allowpassive").checked = local["options-allowpassive"];
        
        document.getElementById("options-crossorigin").elements["header"].value = local["options-crossorigin"];
        
        document.getElementById("options-useautomation").checked = local["options-useautomation"];
        
        /* Keyboard shortcuts */
        
        if (isFirefox)
        {
            chrome.commands.getAll(
            function(commands)
            {
                var i;
                
                for (i = 0; i < commands.length; i++)
                {
                    if (commands[i].name == "_execute_browser_action") document.getElementById("options-shortcuts-browseraction").value = commands[i].shortcut;
                    else if (commands[i].name == "cancelsave") document.getElementById("options-shortcuts-cancelsave").value = commands[i].shortcut;
                }
            });
        }
        
        /* Add listeners for click on tab buttons */
        
        document.getElementById("options-tabbar-general").addEventListener("click",showGeneralTab,false);
        document.getElementById("options-tabbar-saveditems").addEventListener("click",showSavedItemsTab,false);
        document.getElementById("options-tabbar-fileinfo").addEventListener("click",showFileInfoTab,false);
        document.getElementById("options-tabbar-advanced").addEventListener("click",showAdvancedTab,false);
        document.getElementById("options-tabbar-shortcuts").addEventListener("click",showShortcutsTab,false);
        
        /* Add listener for click on show warning checkbox */
        
        document.getElementById("options-showwarning").addEventListener("click",onClickShowWarning,false);
        
        /* Add listener for click on show resources checkbox */
        
        document.getElementById("options-showresources").addEventListener("click",onClickShowResources,false);
        
        /* Add listener for click on prompt comments checkbox */
        
        document.getElementById("options-promptcomments").addEventListener("click",onClickPromptComments,false);
        
        /* Add listener for click on use new save method checkbox */
        
        document.getElementById("options-usenewsavemethod").addEventListener("click",onClickUseNewSaveMethod,false);
        
        /* Add listener for click on remove elements checkbox */
        
        document.getElementById("options-removeelements").addEventListener("click",onClickRemoveElements,false);
        
        /* Add listener for click on save CSS fonts all checkbox */
        
        document.getElementById("options-savecssfontsall").addEventListener("click",onClickSaveCSSFontsAll,false);
        
        /* Add listener for change to URL list file input */
        
        document.getElementById("options-urllistfile").addEventListener("change",onChangeURLListFile,false);
        
        /* Add listener for click on URL list clear button */
        
        document.getElementById("options-urllistclear").addEventListener("click",onClickURLListClear,false);
        
        /* Add listener for click on predefined fields */
        
        document.getElementById("options-predefinedfields").addEventListener("click",onClickPredefinedFields,false);
        
        /* Add listener for click on replace spaces checkbox */
        
        document.getElementById("options-replacespaces").addEventListener("click",onClickReplaceSpaces,false);
        
        /* Add listener for click on save button */
        
        document.getElementById("options-save-button").addEventListener("click",onClickSave,false);
        
        /* Add listener for click on reset all button */
        
        document.getElementById("options-resetall-button").addEventListener("click",onClickResetAll,false);
        
        /* Wait for page layout to complete */
        
        window.setTimeout(
        function()
        {
            var width1,width2,width3,width4,width5,height1,height2,height3,height4,height5;
            
            /* Equalize widths of tabs */
            
            width1 = window.getComputedStyle(document.getElementById("options-tab-general"),null).getPropertyValue("width");
            width2 = window.getComputedStyle(document.getElementById("options-tab-saveditems"),null).getPropertyValue("width");
            width3 = window.getComputedStyle(document.getElementById("options-tab-fileinfo"),null).getPropertyValue("width");
            width4 = window.getComputedStyle(document.getElementById("options-tab-advanced"),null).getPropertyValue("width");
            width5 = window.getComputedStyle(document.getElementById("options-tab-shortcuts"),null).getPropertyValue("width");
            
            width1 = width1.substr(0,width1.length-2);
            width2 = width2.substr(0,width2.length-2);
            width3 = width3.substr(0,width3.length-2);
            width4 = width4.substr(0,width4.length-2);
            width5 = width5.substr(0,width5.length-2);
            
            width1 = Math.max(width1,width2,width3,width4,width5);
            
            document.getElementById("options-tab-general").style.setProperty("width",width1 + "px","");
            document.getElementById("options-tab-saveditems").style.setProperty("width",width1 + "px","");
            document.getElementById("options-tab-fileinfo").style.setProperty("width",width1 + "px","");
            document.getElementById("options-tab-advanced").style.setProperty("width",width1 + "px","");
            document.getElementById("options-tab-shortcuts").style.setProperty("width",width1 + "px","");
            
            /* Equalize heights of tabs */
            
            height1 = window.getComputedStyle(document.getElementById("options-tab-general"),null).getPropertyValue("height");
            height2 = window.getComputedStyle(document.getElementById("options-tab-saveditems"),null).getPropertyValue("height");
            height3 = window.getComputedStyle(document.getElementById("options-tab-fileinfo"),null).getPropertyValue("height");
            height4 = window.getComputedStyle(document.getElementById("options-tab-advanced"),null).getPropertyValue("height");
            height5 = window.getComputedStyle(document.getElementById("options-tab-shortcuts"),null).getPropertyValue("height");
            
            height1 = height1.substr(0,height1.length-2);
            height2 = height2.substr(0,height2.length-2);
            height3 = height3.substr(0,height3.length-2);
            height4 = height4.substr(0,height4.length-2);
            height5 = height5.substr(0,height5.length-2);
            
            height1 = Math.max(height1,height2,height3,height4,height5);
            
            document.getElementById("options-tab-general").style.setProperty("height",height1 + "px","");
            document.getElementById("options-tab-saveditems").style.setProperty("height",height1 + "px","");
            document.getElementById("options-tab-fileinfo").style.setProperty("height",height1 + "px","");
            document.getElementById("options-tab-advanced").style.setProperty("height",height1 + "px","");
            document.getElementById("options-tab-shortcuts").style.setProperty("height",height1 + "px","");
            
            /* Show general tab */
            
            showGeneralTab();
            
            document.getElementById("options").style.setProperty("opacity","1","");
        },50);
    });
}

/************************************************************************/

/* Select tab */

function showGeneralTab(event)
{
    document.getElementById("options-tabbar-general").setAttribute("selected","");
    document.getElementById("options-tabbar-saveditems").removeAttribute("selected");
    document.getElementById("options-tabbar-fileinfo").removeAttribute("selected");
    document.getElementById("options-tabbar-advanced").removeAttribute("selected");
    document.getElementById("options-tabbar-shortcuts").removeAttribute("selected");
    
    document.getElementById("options-tab-general").style.setProperty("display","block","");
    document.getElementById("options-tab-saveditems").style.setProperty("display","none","");
    document.getElementById("options-tab-fileinfo").style.setProperty("display","none","");
    document.getElementById("options-tab-advanced").style.setProperty("display","none","");
    document.getElementById("options-tab-shortcuts").style.setProperty("display","none","");
}

function showSavedItemsTab(event)
{
    document.getElementById("options-tabbar-general").removeAttribute("selected");
    document.getElementById("options-tabbar-saveditems").setAttribute("selected","");
    document.getElementById("options-tabbar-fileinfo").removeAttribute("selected");
    document.getElementById("options-tabbar-advanced").removeAttribute("selected");
    document.getElementById("options-tabbar-shortcuts").removeAttribute("selected");
    
    document.getElementById("options-tab-general").style.setProperty("display","none","");
    document.getElementById("options-tab-saveditems").style.setProperty("display","block","");
    document.getElementById("options-tab-fileinfo").style.setProperty("display","none","");
    document.getElementById("options-tab-advanced").style.setProperty("display","none","");
    document.getElementById("options-tab-shortcuts").style.setProperty("display","none","");
}

function showFileInfoTab(event)
{
    document.getElementById("options-tabbar-general").removeAttribute("selected");
    document.getElementById("options-tabbar-saveditems").removeAttribute("selected");
    document.getElementById("options-tabbar-fileinfo").setAttribute("selected","");
    document.getElementById("options-tabbar-advanced").removeAttribute("selected");
    document.getElementById("options-tabbar-shortcuts").removeAttribute("selected");
    
    document.getElementById("options-tab-general").style.setProperty("display","none","");
    document.getElementById("options-tab-saveditems").style.setProperty("display","none","");
    document.getElementById("options-tab-fileinfo").style.setProperty("display","block","");
    document.getElementById("options-tab-advanced").style.setProperty("display","none","");
    document.getElementById("options-tab-shortcuts").style.setProperty("display","none","");
}

function showAdvancedTab(event)
{
    document.getElementById("options-tabbar-general").removeAttribute("selected");
    document.getElementById("options-tabbar-saveditems").removeAttribute("selected");
    document.getElementById("options-tabbar-fileinfo").removeAttribute("selected");
    document.getElementById("options-tabbar-advanced").setAttribute("selected","");
    document.getElementById("options-tabbar-shortcuts").removeAttribute("selected");
    
    document.getElementById("options-tab-general").style.setProperty("display","none","");
    document.getElementById("options-tab-saveditems").style.setProperty("display","none","");
    document.getElementById("options-tab-fileinfo").style.setProperty("display","none","");
    document.getElementById("options-tab-advanced").style.setProperty("display","block","");
    document.getElementById("options-tab-shortcuts").style.setProperty("display","none","");
}

function showShortcutsTab(event)
{
    document.getElementById("options-tabbar-general").removeAttribute("selected");
    document.getElementById("options-tabbar-saveditems").removeAttribute("selected");
    document.getElementById("options-tabbar-fileinfo").removeAttribute("selected");
    document.getElementById("options-tabbar-advanced").removeAttribute("selected");
    document.getElementById("options-tabbar-shortcuts").setAttribute("selected","");
    
    document.getElementById("options-tab-general").style.setProperty("display","none","");
    document.getElementById("options-tab-saveditems").style.setProperty("display","none","");
    document.getElementById("options-tab-fileinfo").style.setProperty("display","none","");
    document.getElementById("options-tab-advanced").style.setProperty("display","none","");
    document.getElementById("options-tab-shortcuts").style.setProperty("display","block","");
}

/************************************************************************/

/* Enable or Disable options */

function onClickShowWarning(event)
{
    document.getElementById("options-skipwarningscomments").disabled = !(document.getElementById("options-showwarning").checked ||
                                                                         document.getElementById("options-showresources").checked ||
                                                                         document.getElementById("options-promptcomments").checked);
}

function onClickShowResources(event)
{
    document.getElementById("options-skipwarningscomments").disabled = !(document.getElementById("options-showwarning").checked ||
                                                                         document.getElementById("options-showresources").checked ||
                                                                         document.getElementById("options-promptcomments").checked);
}

function onClickPromptComments(event)
{
    document.getElementById("options-skipwarningscomments").disabled = !(document.getElementById("options-showwarning").checked ||
                                                                         document.getElementById("options-showresources").checked ||
                                                                         document.getElementById("options-promptcomments").checked);
}

function onClickUseNewSaveMethod(event)
{
    document.getElementById("options-showsaveasdialog").disabled = !document.getElementById("options-usenewsavemethod").checked;
}

function onClickRemoveElements(event)
{
    document.getElementById("options-rehideelements").disabled = document.getElementById("options-removeelements").checked;
}

function onClickSaveCSSFontsAll(event)
{
    document.getElementById("options-savecssfontswoff").disabled = document.getElementById("options-savecssfontsall").checked;
}

function onClickPredefinedFields(event)
{
    var element,value,start,end;
    
    if (event.target.localName == "label")
    {
        element = document.getElementById("options-savedfilename");
        
        if (event.target.textContent == "Clear Text") element.value = "";
        else
        {
            start = element.selectionStart;
            end = element.selectionEnd;
            
            element.value = element.value.slice(0,start) + event.target.textContent + element.value.slice(end);
            
            element.selectionStart = element.selectionEnd = start + event.target.textContent.length;
        }
        
        element.focus();
    }
}

function onClickReplaceSpaces(event)
{
    document.getElementById("options-replacechar").disabled = !document.getElementById("options-replacespaces").checked;
}

/************************************************************************/

/* Load URL list */

function onChangeURLListFile(event)
{
    var reader;
    
    reader = new FileReader();
    reader.onload = onload;
    reader.readAsText(event.target.files[0]);
    
    function onload()
    {
        var i,text,element,name;
        var urls = [];
        
        text = reader.result;
        
        urls = text.split("\n");
        
        for (i = urls.length-1; i >= 0; i--)
        {
            urls[i] = urls[i].trim();
            
            try { urls[i] = new URL(urls[i]).href; } catch (e) { urls.splice(i,1); }
        }
        
        element = document.getElementById("options-urllistname");
        
        element.textContent = name = event.target.value.substr(12);
        
        element.style.width = "auto";
        
        for (i = Math.trunc(name.length/2); element.offsetWidth > 292+6; i--)
        {
            element.textContent = name.substr(0,i) + "..." + name.substr(-i);
        }
        
        element.style.width = "";
        
        document.getElementById("options-urllistsize").textContent = urls.length + " URLs Listed";
        
        chrome.storage.local.set({ "options-urllisturls": urls, "options-urllistname": element.textContent });
        
        if (urls.length > 0)
        {
            document.getElementById("options-urllistclear").disabled = false;
            document.getElementById("options-urllistsize").style.removeProperty("visibility");
        }
    }
}

/************************************************************************/

/* Clear URL list */

function onClickURLListClear(event)
{
    document.getElementById("options-urllistname").textContent = "";
    document.getElementById("options-urllistsize").textContent = "0 URLs Listed";
    
    document.getElementById("options-urllistclear").disabled = true;
    document.getElementById("options-urllistsize").style.setProperty("visibility","hidden","");
    
    chrome.storage.local.set({ "options-urllisturls": [], "options-urllistname": "" });
    
    event.preventDefault();
}

/************************************************************************/

/* Save options */

function onClickSave(event)
{
    /* Validate saved file name and replacement character */
    
    document.getElementById("options-savedfilename").value = document.getElementById("options-savedfilename").value.trim();
    
    if (document.getElementById("options-savedfilename").value == "")
        document.getElementById("options-savedfilename").value = "%TITLE%";
    
    if (document.getElementById("options-replacechar").value == "")
        document.getElementById("options-replacechar").value = "-";
    
    /* Save options to local storage */
    
    chrome.storage.local.set(
    {
        /* General options */
        
        "options-buttonactiontype": +document.getElementById("options-buttonaction").elements["type"].value,
        "options-buttonactionitems": +document.getElementById("options-buttonaction").elements["items"].value,
        
        "options-showsubmenu": document.getElementById("options-showsubmenu").checked,
        "options-showwarning": document.getElementById("options-showwarning").checked,
        "options-showresources": document.getElementById("options-showresources").checked,
        "options-promptcomments": document.getElementById("options-promptcomments").checked,
        "options-skipwarningscomments": document.getElementById("options-skipwarningscomments").checked,
        "options-usenewsavemethod": document.getElementById("options-usenewsavemethod").checked,
        "options-showsaveasdialog": document.getElementById("options-showsaveasdialog").checked,
        "options-closetabafter": document.getElementById("options-closetabafter").checked,
        
        "options-loadlazycontent": document.getElementById("options-loadlazycontent").checked,
        "options-lazyloadtype": document.getElementById("options-lazyloadtype").value,
        "options-loadlazyimages": document.getElementById("options-loadlazyimages").checked,
        "options-retaincrossframes": document.getElementById("options-retaincrossframes").checked,
        "options-mergecssimages": document.getElementById("options-mergecssimages").checked,
        "options-executescripts": document.getElementById("options-executescripts").checked,
        "options-removeunsavedurls": document.getElementById("options-removeunsavedurls").checked,
        "options-removeelements": document.getElementById("options-removeelements").checked,
        "options-rehideelements": document.getElementById("options-rehideelements").checked,
        "options-includeinfobar": document.getElementById("options-includeinfobar").checked,
        "options-includesummary": document.getElementById("options-includesummary").checked,
        "options-formathtml": document.getElementById("options-formathtml").checked,
        
        /* Saved Items options */
        
        "options-savehtmlaudiovideo": document.getElementById("options-savehtmlaudiovideo").checked,
        "options-savehtmlobjectembed": document.getElementById("options-savehtmlobjectembed").checked,
        "options-savehtmlimagesall": document.getElementById("options-savehtmlimagesall").checked,
        "options-savecssimagesall": document.getElementById("options-savecssimagesall").checked,
        "options-savecssfontswoff": document.getElementById("options-savecssfontswoff").checked,
        "options-savecssfontsall": document.getElementById("options-savecssfontsall").checked,
        "options-savescripts": document.getElementById("options-savescripts").checked,
        
        /* File Info options */
        
        "options-savedfilename": document.getElementById("options-savedfilename").value,
        "options-replacespaces": document.getElementById("options-replacespaces").checked,
        "options-replacechar": document.getElementById("options-replacechar").value,
        "options-maxfilenamelength": document.getElementById("options-maxfilenamelength").value,
        
        /* Advanced options */
        
        "options-maxpagetime": +document.getElementById("options-maxpagetime").value,
        
        "options-savedelaytime": +document.getElementById("options-savedelaytime").value,
        
        "options-lazyloadscrolltime": +document.getElementById("options-lazyloadscrolltime").value,
        "options-lazyloadshrinktime": +document.getElementById("options-lazyloadshrinktime").value,
        
        "options-maxframedepth": +document.getElementById("options-maxframedepth").value,
        
        "options-maxresourcesize": +document.getElementById("options-maxresourcesize").value,
        
        "options-maxresourcetime": +document.getElementById("options-maxresourcetime").value,
        
        "options-allowpassive": document.getElementById("options-allowpassive").checked,
        
        "options-crossorigin": +document.getElementById("options-crossorigin").elements["header"].value,
        
        "options-useautomation": document.getElementById("options-useautomation").checked
    });
    
    /* Keyboard shortcuts */
    
    if (isFirefox)
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
        
        try
        {
            chrome.commands.update({ name: "cancelsave", shortcut: document.getElementById("options-shortcuts-cancelsave").value });
        }
        catch (e)
        {
            chrome.commands.reset("cancelsave");
            document.getElementById("options-shortcuts-cancelsave").value = "Alt+C";
        }
    }
    
    /* Display saved status for short period */
    
    document.getElementById("options-save-button").innerText = "Saved";
    document.getElementById("options-save-button").style.setProperty("font-weight","bold","");
    
    window.setTimeout(function()
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
    
    document.getElementById("options-buttonaction").elements["type"].value = 0;
    document.getElementById("options-buttonaction").elements["items"].value = 1;
    
    document.getElementById("options-showsubmenu").checked = true;
    document.getElementById("options-showwarning").checked = true;
    document.getElementById("options-showresources").checked = false;
    document.getElementById("options-promptcomments").checked = false;
    document.getElementById("options-skipwarningscomments").checked = true;
    document.getElementById("options-usenewsavemethod").checked = false;
    document.getElementById("options-showsaveasdialog").checked = false;
    document.getElementById("options-closetabafter").checked = false;
    
    document.getElementById("options-loadlazycontent").checked = false;
    document.getElementById("options-lazyloadtype").value = "0";
    document.getElementById("options-loadlazyimages").checked = true;
    document.getElementById("options-retaincrossframes").checked = true;
    document.getElementById("options-mergecssimages").checked = true;
    document.getElementById("options-executescripts").checked = false;
    document.getElementById("options-removeunsavedurls").checked = true;
    document.getElementById("options-removeelements").checked = false;
    document.getElementById("options-rehideelements").checked = false;
    document.getElementById("options-includeinfobar").checked = false;
    document.getElementById("options-includesummary").checked = false;
    document.getElementById("options-formathtml").checked = false;
    
    document.getElementById("options-skipwarningscomments").disabled = false;
    document.getElementById("options-showsaveasdialog").disabled = true;
    document.getElementById("options-rehideelements").disabled = false;
    
    /* Saved Items options */
    
    document.getElementById("options-savehtmlimagesall").checked = false;
    document.getElementById("options-savehtmlaudiovideo").checked = false;
    document.getElementById("options-savehtmlobjectembed").checked = false;
    document.getElementById("options-savecssimagesall").checked = false;
    document.getElementById("options-savecssfontswoff").checked = false;
    document.getElementById("options-savecssfontsall").checked = false;
    document.getElementById("options-savescripts").checked = false;
    
    document.getElementById("options-savecssfontswoff").disabled = false;
    
    /* File Info options */
    
    document.getElementById("options-savedfilename").value = "%TITLE%";
    document.getElementById("options-replacespaces").checked = false;
    document.getElementById("options-replacechar").value = "-";
    document.getElementById("options-maxfilenamelength").value = 150;
    
    document.getElementById("options-replacechar").disabled = true;
    
    /* Advanced options */
    
    document.getElementById("options-maxpagetime").value = 10;
    
    document.getElementById("options-savedelaytime").value = 0;
    
    document.getElementById("options-lazyloadscrolltime").value = 0.2;
    document.getElementById("options-lazyloadshrinktime").value = 0.5;
    
    document.getElementById("options-maxframedepth").value = 5;
    
    document.getElementById("options-maxresourcesize").value = 50;
    
    document.getElementById("options-maxresourcetime").value = 10;
    
    document.getElementById("options-allowpassive").checked = false;
    
    document.getElementById("options-crossorigin").elements["header"].value = 0;
    
    document.getElementById("options-useautomation").checked = false;
    
    /* Keyboard shortcuts */
    
    if (isFirefox)
    {
        document.getElementById("options-shortcuts-browseraction").value = "Alt+A";
        document.getElementById("options-shortcuts-cancelsave").value = "Alt+C";
    }
    
    /* Display reset status for short period */
    
    document.getElementById("options-resetall-button").innerText = "Reset";
    document.getElementById("options-resetall-button").style.setProperty("font-weight","bold","");
    
    window.setTimeout(function()
    {
        document.getElementById("options-resetall-button").innerText = "Reset All";
        document.getElementById("options-resetall-button").style.setProperty("font-weight","normal","");
    }
    ,1000);
}

/************************************************************************/
