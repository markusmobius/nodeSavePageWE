/************************************************************************/
/*                                                                      */
/*      Save Page WE - Generic WebExtension - Shadow DOM Loader         */
/*                                                                      */
/*      Javascript for Shadow DOM Loader                                */
/*                                                                      */
/*      Last Edit - 11 Aug 2022                                         */
/*                                                                      */
/*      Copyright (C) 2019-2022 DW-dev                                  */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*      See LICENCE.txt file and http://www.gnu.org/licenses/           */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/* Notes on Shadow DOM Loader                                           */
/*                                                                      */
/* 1. Shadow DOM Loader is run after saved page content has loaded.     */
/*                                                                      */
/* 2. Moves content from <template data-savepage-shadowroot="">         */
/*    elements into shadowRoot DOM's.                                   */
/*                                                                      */
/* 3. Create shadowloader_compressed.js by compressing source code      */
/*    using dean.edwards.name/packer/ with shrink variables enabled.    */
/*                                                                      */
/************************************************************************/

function savepage_ShadowLoader(maxframedepth)
{
    createShadowDOMs(0,document.documentElement);
    
    function createShadowDOMs(depth,element)
    {
        var i;
        
        if (element.localName == "iframe" || element.localName == "frame")
        {
            if (depth < maxframedepth)
            {
                try
                {
                    if (element.contentDocument.documentElement != null)
                    {
                        createShadowDOMs(depth+1,element.contentDocument.documentElement);
                    }
                }
                catch (e) {}
            }
        }
        else
        {
            if (element.children.length >= 1 && element.children[0].localName == "template" && element.children[0].hasAttribute("data-savepage-shadowroot"))
            {
                element.attachShadow({ mode: "open" }).appendChild(element.children[0].content);
                element.removeChild(element.children[0]);
                
                for (i = 0; i < element.shadowRoot.children.length; i++)
                    if (element.shadowRoot.children[i] != null)
                       createShadowDOMs(depth,element.shadowRoot.children[i]);
            }
            
            for (i = 0; i < element.children.length; i++)
                if (element.children[i] != null)
                   createShadowDOMs(depth,element.children[i]);
        }
    }
}
