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

/* Loaded into all iframes and frames of all content pages */

/* Shares global variable/function namespace with web page scripts */

/* Use wrapper function to separate namespace from web page scripts */

/************************************************************************/

"use strict";

fontfaceInterceptScript();

function fontfaceInterceptScript()
{
    var OrigFontFace;
    
    /********************************************************************/
    
    /* Intercept calls to FontFace constructor and append @font-face rule */
    
    if (window.FontFace)
    {
        OrigFontFace = window.FontFace;
        
        window.FontFace = 
        function ()
        {
            var i,fontfacerule,style;
            
            /* Generate equivalent @font-face rule */
            
            fontfacerule = "@font-face { ";
            fontfacerule += "font-family: " + arguments[0] + "; ";
            fontfacerule += "src: " + arguments[1] + "; ";
            
            if (arguments[2])
            {
                if (arguments[2].weight) fontfacerule += "font-weight: " + arguments[2].weight + "; ";
                if (arguments[2].style) fontfacerule += "font-style: " + arguments[2].style + "; ";
                if (arguments[2].stretch) fontfacerule += "font-stretch: " + arguments[2].stretch + "; ";
            }
            
            fontfacerule += " }";
            
            // console.log("FONTFACE RULE: " + fontfacerule);
            
            /* Append <style> element with @font-face rule to <head> */
            
            style = document.createElement("style");
            style.setAttribute("data-savepage-fontface","");
            style.textContent = fontfacerule;
            document.head.appendChild(style);
            
            return new OrigFontFace(...arguments);
        };
    }
    
    /********************************************************************/
}
