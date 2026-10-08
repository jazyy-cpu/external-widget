/**
 * Downloading the files behind a task's documents.
 *
 * ## A download is two steps, not one
 *
 * There is no URL that simply serves the file. The platform keeps files in FCS
 * (the File Collaboration Server), and 3DSpace only issues a **ticket** that
 * authorises one retrieval:
 *
 *     PUT resources/v1/modeler/documents/{docId}/files/DownloadTicket
 *       -> { data: [ { dataelements: { ticketURL, fileName, fileNames } } ] }
 *
 *     then the browser fetches `ticketURL`, which is on the FCS host, and FCS
 *     serves the bytes.
 *
 * Source: the R2024x `Document REST Services` spec (`200-DownloadTicket` ->
 * `x-schemas/DownloadTicket`), read from the OpenAPI document rather than
 * guessed - the vendor's own Markdown guide lists the endpoints but never
 * prints the response, so the key names came from the schema.
 *
 * ## Why PUT matters here
 *
 * It reads nothing and changes nothing, but the platform declares it a write,
 * so **the CSRF token is mandatory**. `JazzySole/Request` already holds the
 * token, sends it on every write method and refetches once on a token failure
 * (rule R5), so this module does nothing about CSRF itself - which is the
 * point of routing through `Request.send` rather than calling `fetch`.
 *
 * ## The ticket is single-use and short-lived
 *
 * So it is fetched **when the user clicks**, never in advance. Asking for every
 * row's ticket while drawing the panel would issue tickets that mostly expire
 * unused, and would turn one page open into one PUT per document.
 *
 * ## A document may hold SEVERAL files
 *
 * The platform's own document list has a `Files` column, and one document on
 * this system holds four. The whole-document endpoint used here covers that
 * case the way OOTB does: with `useDOCMParamSettings` and `useObjectNameForZip`
 * the server zips a multi-file document and names the zip after the object.
 * The response then carries `fileNames` instead of `fileName`.
 *
 * That decision is deliberately the SERVER's. The per-file endpoint
 * (`.../files/{fileId}/DownloadTicket`) would mean listing the files first -
 * one extra call per document - and then re-implementing the zipping rule in
 * the client, where it would drift from the platform's.
 *
 * ## `hasFiles` is the thing to check first
 *
 * A Document object can exist with no file checked in - and on this platform
 * that is the normal state of a generated form document. Every deliverable in
 * the October capture had `hasfiles: "FALSE"`. Asking for a ticket for one of
 * those is a request that can only fail, so the panel never offers the button.
 */
define('IRSTasks/services/DocumentService', [
    'JazzySole/Request',
    'IRSTasks/Log'
], function (Request, Log) {
    'use strict';

    var PATH = 'resources/v1/modeler/documents/';

    /**
     * What the OOTB Document widget sends, copied from its own request.
     *
     *   useDOCMParamSettings  apply the Document Management parameter settings,
     *                         which is what decides zipping for a multi-file
     *                         document
     *   useObjectNameForZip   name that zip after the OBJECT, so four files
     *                         arrive as `multiple documet.zip` and not as a
     *                         generated name
     *   lightweight           false - the real files, not a lightweight form
     *
     * A document holding several files is normal (the platform's own list has a
     * `Files` column, and one of ours holds four). Sending these means the
     * server decides exactly as it does for the OOTB widget, instead of us
     * inventing a second rule in the client.
     */
    var DOWNLOAD_PARAMS = {
        useDOCMParamSettings: 'true',
        useObjectNameForZip: 'true',
        lightweight: 'false'
    };

    function first(body) {
        var data = (body && body.data) || [];
        var list = Array.isArray(data) ? data : [data];
        return list[0] || null;
    }

    /**
     * The FCS ticket for every file of one document.
     *
     * The whole-document form is used rather than the per-file one
     * (`.../files/{fileId}/DownloadTicket`): the task response tells us a
     * document HAS files but not their ids, so the per-file form would need a
     * second call to find out, and these documents hold one file each.
     *
     * @param {string} docId the document's physical id
     * @returns {Promise<{url: string, fileName: string}>}
     */
    function ticket(docId) {
        if (!docId) {
            return Promise.reject(new Error('No document id was given.'));
        }

        return Request.send(PATH + docId + '/files/DownloadTicket', {
            method: 'PUT',
            params: DOWNLOAD_PARAMS
        }).then(function (body) {
            var item = first(body) || {};
            var de = item.dataelements || {};
            var url = de.ticketURL || '';
            if (!url) {
                // a 200 with no ticket means the document has no file, or the
                // user may not read it - both are the platform's answer, not a
                // fault in the call, so the message says what was asked for
                throw new Error('The platform returned no download ticket for ' +
                                'this document.');
            }
            // `fileName` for one file, `fileNames` for several - the second
            // is what comes back when the server zipped a multi-file document
            return {
                url: url,
                fileName: de.fileName || '',
                fileNames: de.fileNames || '',
                zipped: !!de.fileNames && !de.fileName
            };
        });
    }

    /**
     * Hand the file to the browser - with no tab, which is the whole fix.
     *
     * ## What was wrong with `window.open`
     *
     * The first version opened the ticket in a new tab. FCS answers
     * `Content-Disposition: attachment`, so the browser downloads and discards
     * the tab - usually. Measured on 2026-10-08: the `.toml` (231 bytes)
     * downloaded and the tab vanished; the `.pdf` (194 KB) left a **tab sitting
     * on a Chrome error page**, which is exactly what the user reported as
     * *"the second one is not opening"*.
     *
     * Both tickets were fine. Checked directly: each returned 200 with
     * `Content-Disposition: attachment` and the right byte count. The fault was
     * never the platform, it was opening a tab for something that is not a page.
     *
     * A tab is the wrong instrument anyway: it is subject to the popup blocker,
     * it flashes, and an FCS ticket is single-use, so anything that reloads that
     * tab - a user pressing F5, the browser restoring it - hits a consumed
     * ticket and shows an error.
     *
     * ## What the platform itself does
     *
     * The OOTB Document widget opens no tab. It creates an element, clicks it,
     * and removes it: after a download nothing referencing `fcs` is left in its
     * DOM. This does the same. It is not subject to the popup blocker, because
     * a navigation that turns into a download is not a popup.
     *
     * `rel=noopener` stays: `download` is ignored cross-origin, so this can
     * still be treated as a navigation, and the FCS origin must never get a
     * handle on the dashboard window.
     */
    function handToBrowser(url, fileName) {
        var link = document.createElement('a');
        link.href = url;
        // cross-origin, so the browser ignores this and uses the server's
        // Content-Disposition name instead - which is the platform's own name,
        // and the right one. It is set anyway for the same-origin case
        link.setAttribute('download', fileName || '');
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        // removed immediately: the ticket is single-use, so a link left in the
        // page is a button that cannot work twice
        document.body.removeChild(link);
    }

    return {
        /**
         * Fetch a ticket and hand the file to the browser.
         *
         * The browser follows the ticket itself rather than the widget fetching
         * it: that is what produces a real download, with the platform's own
         * file name and the browser's own progress and save dialog. Reading it
         * into memory first would mean holding a whole file in the widget and
         * re-inventing all of that.
         *
         * @returns {Promise<{url, fileName, fileNames, zipped}>} resolves once
         *          the file has been handed over; rejects with a message fit to
         *          show the user
         */
        download: function (docId, name) {
            return ticket(docId).then(function (result) {
                var what = result.fileName ||
                           (result.fileNames ? 'zip of ' + result.fileNames : '');
                Log.info('download: ' + (name || docId) +
                         (what ? ' -> ' + what : '') +
                         (result.zipped ? ' (several files, zipped by the server)' : ''));
                handToBrowser(result.url, result.fileName);
                return result;
            });
        },

        /** for tests only */
        _ticket: ticket,
        _handToBrowser: handToBrowser
    };
});
