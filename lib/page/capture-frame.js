/************************************************************************/
/*                                                                      */
/*      Based on: Save Page WE - Generic WebExtension - Frame Pages     */
/*                (content-frame.js)                                    */
/*      Copyright (C) 2016-2023 DW-dev                                  */
/*                                                                      */
/*      Adapted for Node/Puppeteer by Markus Mobius                     */
/*                                                                      */
/*      Distributed under the GNU General Public License version 2      */
/*      See LICENCE.txt file and http://www.gnu.org/licenses/           */
/*                                                                      */
/************************************************************************/

/* Evaluated by Node in every frame of the page (including the main     */
/* frame and cross-origin frames) before the page is saved.             */
/*                                                                      */
/* - Labels child <iframe>/<frame> elements with data-savepage-key      */
/* - Records CSS-in-JS rules, blob images and canvas contents as        */
/*   data-savepage-* attributes                                         */
/* - Returns the frame's key, URL and loaded fonts, plus its HTML if    */
/*   the frame cannot be accessed from the main frame                   */

function savepage_captureFrame() {
    "use strict";

    var key, doctype, htmltext;
    var loadedfonts = [];

    if (document.documentElement == null) return null;

    if (document.URL.substr(0, 13) == "chrome-error:") return null;  /* frame load failed or was blocked */

    identifyFrames(document.documentElement);

    saveAdoptedStyleSheets();

    key = frameKeyOf(window);

    document.fonts.forEach(  /* CSS Font Loading Module */
        function (font) {
            if (font.status == "loaded")  /* font is being used in this document */ {
                loadedfonts.push({ family: font.family, weight: font.weight, style: font.style, stretch: font.stretch });
            }
        });

    document.querySelectorAll("style").forEach(
        function (element) {
            var i, csstext, dupelem, dupsheet;

            if (!element.disabled) {
                try {
                    /* Count rules in element.textContent by creating duplicate element */

                    dupelem = element.ownerDocument.createElement("style");
                    dupelem.textContent = element.textContent;
                    element.ownerDocument.body.appendChild(dupelem);
                    dupsheet = dupelem.sheet;
                    dupelem.remove();

                    /* There may be rules in element.sheet.cssRules that are not in element.textContent */
                    /* For example if the page uses CSS-in-JS Libraries */

                    if (dupsheet.cssRules.length != element.sheet.cssRules.length) {
                        csstext = "";

                        for (i = 0; i < element.sheet.cssRules.length; i++)
                            csstext += element.sheet.cssRules[i].cssText + "\n";

                        element.setAttribute("data-savepage-sheetrules", csstext);
                    }
                }
                catch (e) { }
            }
        });

    document.querySelectorAll("img").forEach(
        function (element) {
            var datauri;

            if (element.currentSrc.substr(0, 5) == "blob:") {
                datauri = createCanvasDataURL(element);

                if (datauri != "") element.setAttribute("data-savepage-blobdatauri", datauri);
            }
        });

    document.querySelectorAll("video").forEach(
        function (element) {
            var datauri;

            if (!element.hasAttribute("poster") && element.currentSrc.substr(0, 5) == "blob:") {
                datauri = createCanvasDataURL(element);

                if (datauri != "") element.setAttribute("data-savepage-blobdatauri", datauri);
            }
        });

    document.querySelectorAll("canvas").forEach(
        function (element) {
            var datauri;

            try {
                datauri = element.toDataURL("image/png", "");

                if (datauri != "") element.setAttribute("data-savepage-canvasdatauri", datauri);
            }
            catch (e) { }
        });

    /* The main frame reads accessible frames directly from the live DOM, so only inaccessible frames need their HTML */

    htmltext = "";

    if (!accessibleFromTop()) {
        doctype = document.doctype;

        if (doctype != null) {
            htmltext = '<!DOCTYPE ' + doctype.name + (doctype.publicId ? ' PUBLIC "' + doctype.publicId + '"' : '') +
                ((doctype.systemId && !doctype.publicId) ? ' SYSTEM' : '') + (doctype.systemId ? ' "' + doctype.systemId + '"' : '') + '>';
        }

        htmltext += document.documentElement.outerHTML;

        htmltext = htmltext.replace(/<head([^>]*)>/, function (match, attributes) { return "<head" + attributes + "><base href=\"" + document.baseURI + "\">"; });
    }

    return { key: key, url: document.baseURI, html: htmltext, fonts: loadedfonts };

    /* Key is "0" for the main frame, then "-n" for the index of each frame in its parent's frames collection */

    /* Constructable style sheets (document.adoptedStyleSheets and shadowRoot.adoptedStyleSheets) have no */
    /* element in the DOM, so copy their rules into <style> elements, which are saved like any other.     */
    /* Adopted sheets apply after all other style sheets, so the copies are added at the end.            */

    function saveAdoptedStyleSheets() {
        document.querySelectorAll("style[data-savepage-adopted]").forEach(function (element) { element.remove(); });

        addAdoptedStyle(document, document.body || document.documentElement);

        walk(document.documentElement);

        function walk(element) {
            var k, shadowroot = element.shadowRoot || element.openOrClosedShadowRoot;  /* closed shadow roots are exposed by Node */

            if (shadowroot != null) {
                shadowroot.querySelectorAll("style[data-savepage-adopted]").forEach(function (style) { style.remove(); });

                addAdoptedStyle(shadowroot, shadowroot);

                for (k = 0; k < shadowroot.children.length; k++) walk(shadowroot.children[k]);
            }

            for (k = 0; k < element.children.length; k++) walk(element.children[k]);
        }
    }

    function addAdoptedStyle(root, parent) {
        var i, j, sheet, style, csstext;

        if (!root.adoptedStyleSheets || root.adoptedStyleSheets.length == 0 || parent == null) return;

        csstext = "";

        for (i = 0; i < root.adoptedStyleSheets.length; i++) {
            sheet = root.adoptedStyleSheets[i];

            if (sheet.disabled) continue;

            try {
                if (sheet.media && sheet.media.length > 0) csstext += "@media " + sheet.media.mediaText + " {\n";
                for (j = 0; j < sheet.cssRules.length; j++) csstext += sheet.cssRules[j].cssText + "\n";
                if (sheet.media && sheet.media.length > 0) csstext += "}\n";
            }
            catch (e) { }
        }

        if (csstext == "") return;

        style = document.createElement("style");
        style.setAttribute("data-savepage-adopted", "");
        style.textContent = csstext;
        parent.appendChild(style);
    }

    function frameKeyOf(win) {
        var i, parentwin, framekey;

        framekey = "";

        while (win != window.top) {
            parentwin = win.parent;

            for (i = 0; i < parentwin.frames.length; i++) {
                if (parentwin.frames[i] == win) break;
            }

            framekey = "-" + i + framekey;
            win = parentwin;
        }

        return "0" + framekey;
    }

    function identifyFrames(element) {
        var i, shadowroot;

        if (element.localName == "iframe" || element.localName == "frame")  /* frame elements */ {
            if (element.contentWindow != null) {
                element.setAttribute("data-savepage-key", frameKeyOf(element.contentWindow));

                try {
                    if (element.contentDocument.documentElement != null)  /* in case web page not fully loaded before naming */ {
                        identifyFrames(element.contentDocument.documentElement);
                    }
                }
                catch (e) { }  /* cross-origin frame - labels its own child frames */
            }
        }
        else {
            shadowroot = element.shadowRoot || element.openOrClosedShadowRoot;

            if (shadowroot != null) {
                for (i = 0; i < shadowroot.children.length; i++)
                    if (shadowroot.children[i] != null) identifyFrames(shadowroot.children[i]);
            }

            for (i = 0; i < element.children.length; i++)
                if (element.children[i] != null)  /* in case web page not fully loaded before finding */
                    identifyFrames(element.children[i]);
        }
    }

    function accessibleFromTop() {
        var win;

        try {
            win = window;

            while (win != window.top) {
                if (win.frameElement == null) return false;  /* null if parent is cross-origin */

                if (win.parent.document.documentElement == null) return false;

                win = win.parent;
            }

            return true;
        }
        catch (e) {
            return false;
        }
    }

    function createCanvasDataURL(element) {
        var canvas, context;

        canvas = document.createElement("canvas");
        canvas.width = element.clientWidth;
        canvas.height = element.clientHeight;

        try {
            context = canvas.getContext("2d");
            context.drawImage(element, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL("image/png", "");
        }
        catch (e) { }

        return "";
    }
}
