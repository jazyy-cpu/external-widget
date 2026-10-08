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
            method: 'PUT'
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
            return {
                url: url,
                fileName: de.fileName || de.fileNames || ''
            };
        });
    }

    return {
        /**
         * Fetch a ticket and hand the file to the browser.
         *
         * The ticket URL is opened rather than fetched: letting the browser
         * follow it is what produces a real download, with the platform's own
         * file name and the browser's own progress and save dialog. Reading it
         * into memory first would mean holding a whole file in the widget and
         * re-inventing all of that.
         *
         * `noopener` is not optional - without it the FCS page can reach back
         * into the dashboard through `window.opener`.
         *
         * @returns {Promise<{url, fileName}>} resolves once the ticket is held;
         *          rejects with a message fit to show the user
         */
        download: function (docId, name) {
            return ticket(docId).then(function (result) {
                Log.info('download: ticket issued for ' + (name || docId) +
                         (result.fileName ? ' (' + result.fileName + ')' : ''));
                window.open(result.url, '_blank', 'noopener,noreferrer');
                return result;
            });
        },

        /** for tests only */
        _ticket: ticket
    };
});
