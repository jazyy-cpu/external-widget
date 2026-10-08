/**
 * The task's documents, in a panel beside the form.
 *
 * Two headed groups - **Deliverables** and **Attachments** - each row a
 * document with a download button, and one control that collapses the whole
 * panel away.
 *
 * ## Why a panel and not a form section
 *
 * Every numbered section of R&D-PRJ-01 is PROJECT data. The deliverable and
 * the attachment belong to the **task**, so giving them a Roman numeral would
 * invent a section the printed form does not have. They also want to be
 * reachable at any scroll position - the user's words were *"this feature will
 * be used very frequently"* - and a 16-section form is three screens tall, so
 * anything in the flow is out of sight most of the time.
 *
 * The panel is therefore `position: sticky`: it stays in view as the form
 * scrolls past it, inside the one scrolling region rather than making a second.
 *
 * ## Collapsing, and what is remembered
 *
 * The toggle is the user's (*"one button that will collapse and expand"*). The
 * state is kept in a module variable, so it survives moving between tasks
 * within a session but not a reload - deliberately: the panel defaults to OPEN
 * because it is the frequently used thing, and a reload should go back to that
 * rather than honouring a collapse somebody did once a week ago.
 *
 * The heading keeps the counts while collapsed. A collapsed panel saying
 * nothing would make a reader open it just to find out whether it was worth
 * opening.
 *
 * ## Two lists, never merged
 *
 * A deliverable is what the task is meant to produce; an attachment is
 * supporting material somebody added. The platform keeps them on separate
 * relationships (`deliverables` and `references`) and so does this.
 *
 * ## The download button appears only where there is a file
 *
 * `hasFiles` comes from the platform's own `hasfiles` flag. A Document with
 * nothing checked in is normal here - every deliverable in the October capture
 * was one - and offering a button that can only fail is worse than showing why
 * there is none.
 */
define('IRSTasks/views/TaskDocumentsPanel', [
    'IRSTasks/services/DocumentService',
    'IRSTasks/Log'
], function (DocumentService, Log) {
    'use strict';

    /**
     * Open unless the user closed it, for this session.
     *
     * Module-level on purpose: see the comment above. `localStorage` would
     * outlive the reason for the decision.
     */
    var collapsed = false;

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined && text !== null) { node.textContent = text; }
        return node;
    }

    /**
     * A caret, drawn rather than loaded.
     *
     * Bootstrap ships no icon font - `bootstrap-icons` is a separate package -
     * and one inline SVG is smaller than adding a dependency and its CDN rule
     * for a single triangle.
     */
    function caret(isCollapsed) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '12');
        svg.setAttribute('height', '12');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('aria-hidden', 'true');
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', isCollapsed
            ? 'M6 3.5 11.5 8 6 12.5z'        // pointing right  - closed
            : 'M3.5 6 8 11.5 12.5 6z');      // pointing down   - open
        svg.appendChild(path);
        return svg;
    }

    /** A down-arrow-into-tray glyph for the download button. */
    function downloadIcon() {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '13');
        svg.setAttribute('height', '13');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('aria-hidden', 'true');
        var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrow.setAttribute('d', 'M7.25 1h1.5v7.19l2.22-2.22 1.06 1.06L8 11.06 3.97 7.03l1.06-1.06 2.22 2.22z');
        var tray = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tray.setAttribute('d', 'M2 11h1.5v2.5h9V11H14v4H2z');
        svg.appendChild(arrow);
        svg.appendChild(tray);
        return svg;
    }

    /**
     * One document.
     *
     * The title is the line a reader scans - `config.toml`, `JIWAN TEST` - and
     * the autonamed id (`DOC-85756263-0000021`) is the second line, because it
     * identifies the object but says nothing about it. Where a document has no
     * title the id is promoted rather than leaving the first line blank.
     */
    function documentRow(item, onError, last) {
        var row = el('div', 'irs-doc d-flex align-items-center gap-2 py-1' +
                            (last ? '' : ' border-bottom'));

        // `flex-grow-1` is Bootstrap's; `irs-min0` is not, because Bootstrap
        // 5.3.8 ships no `min-w-0` - and without it a flex item refuses to
        // shrink below its content, so `text-truncate` never truncates
        var text = el('div', 'irs-doc-text flex-grow-1 irs-min0');
        var title = item.title || item.name;
        text.appendChild(el('div', 'irs-doc-title fw-medium text-truncate', title));

        var meta = [];
        if (item.name && item.title) { meta.push(item.name); }
        if (item.revision) { meta.push('rev ' + item.revision); }
        if (item.state) { meta.push(item.state); }
        text.appendChild(el('div', 'irs-doc-meta small text-secondary text-truncate',
                            meta.join('  ·  ')));
        row.appendChild(text);

        if (!item.hasFiles) {
            // said, not hidden: "no button" and "no file" look identical
            // otherwise, and the second is something the user may want to fix
            row.appendChild(el('span',
                'irs-doc-nofile small fst-italic text-secondary flex-shrink-0',
                'no file'));
            return row;
        }

        var button = el('button', 'btn btn-sm btn-outline-primary irs-doc-btn ' +
                                  'd-inline-flex align-items-center flex-shrink-0');
        button.type = 'button';
        button.title = 'Download' + (item.extension ? ' ' + item.extension : '');
        button.setAttribute('aria-label', 'Download ' + title);
        button.appendChild(downloadIcon());
        if (item.extension) {
            button.appendChild(el('span', 'ms-1', item.extension.replace(/^\./, '')));
        }

        button.addEventListener('click', function () {
            // the ticket is single-use and short-lived, so it is fetched HERE,
            // on the click, and never while drawing the panel
            button.disabled = true;
            DocumentService.download(item.id, title).then(function () {
                button.disabled = false;
            }).catch(function (err) {
                button.disabled = false;
                var message = (err && err.message) ? err.message : String(err);
                Log.warn('download failed for ' + title + ': ' + message);
                onError('"' + title + '" could not be downloaded: ' + message);
            });
        });

        row.appendChild(button);
        return row;
    }

    /** The count beside a heading - Bootstrap's pill badge, not a drawn one. */
    function countBadge(total, extra) {
        return el('span', 'irs-doc-count badge rounded-pill text-bg-light border' +
                          (extra ? ' ' + extra : ''), String(total));
    }

    /** One headed group, with its count - shown even when the group is empty. */
    function group(heading, items, onError, first) {
        var wrap = el('div', 'irs-doc-group' + (first ? '' : ' mt-3'));
        var head = el('div', 'irs-doc-head d-flex align-items-center gap-2 ' +
                             'border-bottom pb-1 mb-1 fw-semibold');
        head.appendChild(el('span', '', heading));
        head.appendChild(countBadge(items.length));
        wrap.appendChild(head);

        if (!items.length) {
            wrap.appendChild(el('div', 'irs-doc-empty small fst-italic text-secondary',
                                'None on this task.'));
            return wrap;
        }
        items.forEach(function (item, index) {
            wrap.appendChild(documentRow(item, onError, index === items.length - 1));
        });
        return wrap;
    }

    return {
        /**
         * @param {Object} task  as shaped by TaskDetailService - `deliverables`
         *                       and `attachments`
         * @returns {HTMLElement} the panel, ready to append
         */
        render: function (task) {
            var deliverables = (task && task.deliverables) || [];
            var attachments = (task && task.attachments) || [];
            var total = deliverables.length + attachments.length;

            var panel = el('div', 'card irs-docs');

            // `p-0` so the button fills the header: the whole bar is the
            // target. `btn-light` brings Bootstrap's own hover and focus ring,
            // which is why this needs no hover rule of its own
            var header = el('div', 'card-header irs-docs-header p-0');
            var toggle = el('button', 'btn btn-light btn-sm irs-docs-toggle w-100 ' +
                                      'text-start border-0 rounded-0 d-flex ' +
                                      'align-items-center gap-2 py-2 px-3');
            toggle.type = 'button';
            toggle.setAttribute('aria-expanded', String(!collapsed));

            var label = el('span', 'fw-semibold', 'Documents');
            var count = countBadge(total, 'ms-1');

            function paintToggle() {
                while (toggle.firstChild) { toggle.removeChild(toggle.firstChild); }
                toggle.appendChild(caret(collapsed));
                toggle.appendChild(label);
                toggle.appendChild(count);
                toggle.setAttribute('aria-expanded', String(!collapsed));
            }
            paintToggle();
            header.appendChild(toggle);
            panel.appendChild(header);

            var body = el('div', 'card-body irs-docs-body p-2 overflow-auto');
            var problem = el('div', 'alert alert-danger py-1 px-2 mb-2 small d-none');
            problem.setAttribute('role', 'alert');
            body.appendChild(problem);

            function onError(message) {
                problem.textContent = message;
                problem.className = 'alert alert-danger py-1 px-2 mb-2 small';
            }

            body.appendChild(group('Deliverables', deliverables, onError, true));
            body.appendChild(group('Attachments', attachments, onError, false));
            panel.appendChild(body);

            function paint() {
                body.style.display = collapsed ? 'none' : '';
                paintToggle();
            }
            paint();

            toggle.addEventListener('click', function () {
                collapsed = !collapsed;
                paint();
            });

            return panel;
        },

        /** for tests only - the collapse state is module-level by design */
        _setCollapsed: function (value) { collapsed = !!value; },
        _isCollapsed: function () { return collapsed; }
    };
});
