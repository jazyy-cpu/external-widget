/**
 * The approver's specimen signature, for the approval chain.
 *
 *     GET resources/v1/irs/signatures/{loginId}   ->  image/svg+xml
 *
 * Our own REST JAR, not an OOTB service: built on 2026-10-03 (worklog
 * `2026-10-03-03`), reading SVG files from `C:\dev\irclass-data\signatures` on
 * the VM, outside the TomEE webapps tree. It requires a platform session and
 * has no upload method.
 *
 * ## The join costs nothing
 *
 * `{loginId}` is the person's platform login, and a route step already carries
 * it as `taskAssigneeUsername`. So the chain needs no person lookup at all -
 * the id is in the route response the panel already has. Measured on the
 * finished route of `T-85756263-0000134`, 2026-10-08:
 *
 *     Project Manager   Sharad S Dhavalikar    admin_platform   200, 2524 B
 *     In-Charge / HOD   Sachin S Awasare       PlmUser2         200, 2011 B
 *     Division Head     Dr. Asokendu Samanta   PlmUser1         200, 1988 B
 *
 * That run also closed the check worklog `2026-10-03-03` had left open since
 * 3 October: the endpoint had only ever been proved to redirect anonymously to
 * 3DPassport, never to answer inside a signed-in session. It does.
 *
 * ## It is a PILOT, and the code assumes a miss is normal
 *
 * The service serves exactly three login ids - `admin_platform`, `PlmUser1`,
 * `PlmUser2` - and answers **404 for every other person**. The three approvers
 * on this system happen to be those three, which makes the chain look complete;
 * a fourth approver will have no signature. That is not an error state and must
 * never render as a broken image: `get()` resolves to `null` and the panel
 * simply leaves the strip out.
 *
 * WP05 lists what real signatures need first - a restricted folder ACL, a rule
 * for who may install or replace a person's image, and an approval-context read
 * rule. Today any authenticated user can fetch any of the three dummy images.
 *
 * ## Why a blob, and not `<img src="https://.../signatures/x">`
 *
 * Two reasons, and either alone would decide it:
 *
 *  1. **The widget is cross-origin to 3DSpace.** It is served from
 *     `external.solize.com` through the dashboard proxy, so a direct `<img>` to
 *     the 3DSpace host is a third-party request and its session cookie is not
 *     dependable. Going through `Request` uses the same authenticated transport
 *     every other call on this page uses.
 *  2. **An SVG rendered through `<img>` cannot run script.** The alternative -
 *     fetching the markup and assigning `innerHTML` - would make a remote
 *     document part of this page's DOM. These files are ours and the endpoint
 *     sets a sandbox CSP, but a blob in an `<img>` removes the question
 *     instead of arguing it, and costs nothing.
 *
 * ## Cached per login, for the session
 *
 * The same person signs more than one step on a multi-cycle task, and the panel
 * re-renders whenever the page is reopened. The cache keeps the PROMISE, not
 * the result, so two steps asking at once still make one call. A miss is cached
 * too - a 404 does not become a 404 per step.
 */
define('IRSTasks/services/SignatureService', [
    'JazzySole/Request',
    'IRSTasks/Log'
], function (Request, Log) {
    'use strict';

    var PATH = 'resources/v1/irs/signatures/';

    /** loginId -> Promise<objectURL|null>, for this session */
    var cache = {};

    function fetchSignature(loginId) {
        // Two things this call needs that an ordinary JSON one does not:
        //
        //   `type: 'text'`  the body is SVG markup; the default parser throws
        //   `Accept`        the service PRODUCES image/svg+xml only, and the
        //                   default Accept made it answer **406 Not Acceptable**
        //                   (measured 2026-10-08 - every signature came back
        //                   empty until this header was sent). An earlier probe
        //                   missed it precisely because it set Accept by hand
        return Request.get(PATH + encodeURIComponent(loginId), {
            type: 'text',
            headers: { 'Accept': 'image/svg+xml' }
        })
            .then(function (body) {
                var markup = typeof body === 'string' ? body : '';
                if (!/<svg[\s>]/i.test(markup)) {
                    // a redirect to 3DPassport lands here as an HTML login page
                    throw new Error('the response was not an SVG');
                }
                var blob = new Blob([markup], { type: 'image/svg+xml' });
                return URL.createObjectURL(blob);
            });
    }

    return {
        /**
         * @param {string} loginId the person's platform login, which a route
         *        step carries as `taskAssigneeUsername`
         * @returns {Promise<string|null>} an object URL for an `<img>`, or
         *          `null` when this person has no signature on file. It does
         *          NOT reject: a miss is the expected case for anyone outside
         *          the three-login pilot, and a rejected promise would make
         *          every caller write the same catch.
         */
        get: function (loginId) {
            if (!loginId) { return Promise.resolve(null); }
            if (cache[loginId]) { return cache[loginId]; }

            cache[loginId] = fetchSignature(loginId).catch(function (err) {
                Log.info('signature: none for ' + loginId +
                         ' (' + ((err && err.message) || err) + ')');
                return null;
            });
            return cache[loginId];
        },

        /** for tests only */
        _reset: function () { cache = {}; },
        _path: PATH
    };
});
