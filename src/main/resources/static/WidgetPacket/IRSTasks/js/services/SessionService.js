/**
 * Who is signed in.
 *
 *     GET resources/modeler/pno/person?current=true
 *
 * OOTB, and already proven on this platform: `JazzySole/Credentials` calls the
 * same resource to build the credential list. It answers:
 *
 *     name       admin_platform                     <- the LOGIN
 *     pid        29374AC5000011F8661CC77B00000000   <- the Person's id
 *     firstname / lastname / email / company
 *
 * `name` is the login, which is what a route step carries as
 * `taskAssigneeUsername`, and `pid` is what an inbox task carries as
 * `relateddata.assignees[0].id`. So either can join a step to the signed-in
 * person; the login is used because the route response already has it and the
 * assignee list would need a second read.
 *
 * ## Why this exists: `modifyAccess` answered the wrong question
 *
 * The approval bar first decided who may act from `modifyAccess` on the inbox
 * task, on the reasoning that the platform should own the access rule rather
 * than the client. Measured on 2026-10-08 that turned out to be a different
 * question. On the route of `T-85756263-0000143`:
 *
 *     signed in                admin_platform
 *     step 2 assigned to       PlmUser2  (Sachin S Awasare)
 *     step 2 `modifyAccess`    TRUE
 *
 * So the bar appeared on a step belonging to somebody else, the user submitted
 * it, and the platform refused the write with **HTTP 400**. `modifyAccess`
 * means "may you edit this object" - true for an administrator on an object
 * they do not own as approver - and not "is this your approval to give".
 *
 * The join on the assignee is therefore not re-implementing an access rule; it
 * is asking the only question that was ever meant. `modifyAccess` is still
 * checked as well, because it catches a locked or read-only object, but it is
 * no longer trusted on its own.
 *
 * ## Cached for the session
 *
 * The signed-in person does not change inside a dashboard session, and the
 * panel asks on every task page. The PROMISE is cached, so two panels opening
 * at once still make one call.
 */
define('IRSTasks/services/SessionService', [
    'JazzySole/Request',
    'IRSTasks/Log'
], function (Request, Log) {
    'use strict';

    var PATH = 'resources/modeler/pno/person';

    /** Promise<{login, pid, fullName}> - one per session */
    var pending = null;

    return {
        /**
         * @returns {Promise<{login: string, pid: string, fullName: string}>}
         *          Never rejects: an unknown user resolves to empty strings, so
         *          a caller joining on the login simply matches nothing and the
         *          approval bar stays hidden. Showing it on a failed identity
         *          check is the one outcome that must not happen.
         */
        me: function () {
            if (pending) { return pending; }

            pending = Request.get(PATH, { params: { current: 'true' } })
                .then(function (body) {
                    // this resource answers the person OBJECT directly, not the
                    // `{data:[...]}` envelope the modeler resources use
                    var person = (body && body.data && body.data[0]) || body || {};
                    var login = person.name || '';
                    Log.info('session: signed in as ' + (login || '(unknown)'));
                    return {
                        login: login,
                        pid: person.pid || person.id || '',
                        fullName: [person.firstname, person.lastname]
                            .filter(Boolean).join(' ').trim() || login
                    };
                })
                .catch(function (err) {
                    Log.warn('session: the signed-in user could not be read (' +
                             ((err && err.message) || err) +
                             '); approval controls will stay hidden');
                    return { login: '', pid: '', fullName: '' };
                });

            return pending;
        },

        /**
         * Is this login the signed-in user?
         *
         * Case-insensitive: ENOVIA login ids are not case sensitive, and a
         * route step's spelling comes from wherever the route was built.
         */
        isMe: function (login) {
            if (!login) { return Promise.resolve(false); }
            return this.me().then(function (me) {
                return !!me.login &&
                    me.login.toLowerCase() === String(login).toLowerCase();
            });
        },

        /** for tests only */
        _reset: function () { pending = null; }
    };
});
