/************************************************************************/
/*                                                                      */
/*      Save Page WE - Generic WebExtension - Content Pages             */
/*                                                                      */
/*      Javascript for Dynamically Loaded Fonts (all frames)            */
/*                                                                      */
/*      Last Edit - 11 Aug 2022                                         */
/*                                                                      */
/*      Copyright (C) 2020-2022 DW-dev                                  */
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
/*                                                                      */
/* developer.chrome.com/docs/extensions/reference/runtime               */
/*                                                                      */
/************************************************************************/

/* Loaded into all iframes and frames of all content pages */

/* Shares global variable/function namespace with other content scripts */

/* Use wrapper function to separate namespace from other content scripts */

/************************************************************************/

"use strict";

fontfaceScript();

function fontfaceScript()
{
    var script;

    /********************************************************************/

    /* Append intercept <script> that executes in context of page */
    
    script = document.createElement("script");
    
    script.setAttribute("data-savepage-fontface","");
    
    script.setAttribute("src",chrome.runtime.getURL("content-fontface-intercept.js"));
    
    document.documentElement.appendChild(script);
    
    script.remove();

    /********************************************************************/
}
