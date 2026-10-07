/**
 * Tabulator column definitions for the task list.
 *
 * The set is taken from the POC's task grid (user, 2026-10-03: "what to show in
 * column that we can take the help of poc project"), which showed:
 *
 *     #  Type  Title  State  Assigned To  Project  Route  Needs Review
 *     Action Required  Actions
 *
 * What is kept, and what changed:
 *
 *   - **Dropped `Needs Review`.** It was a Yes / No attribute of the POC's own
 *     document type. Whether a task needs review is what its state says.
 *   - **Dropped the `Actions` button column.** The POC opened a modal from it;
 *     here the title is the link, as in the project widget, so the row has one
 *     obvious target instead of two.
 *   - **Added `Department`** (user's point 3): a form may hide attributes
 *     depending on the project's department, so the grid should say which one a
 *     task belongs to.
 *   - **Added `Route Task`** (user's point 4): the route task connected to the
 *     custom subtask, beside the route itself.
 *   - **Added `Est. Finish`**, so a list of approvals can be sorted by when
 *     they are due.
 *
 * No header filter on any column: one search control in the toolbar instead,
 * the same decision as the project grid - a filter box under every heading
 * costs a whole row of height in a frame this short.
 *
 * Badges are built as DOM nodes through `JazzySole/Format`, never as HTML
 * strings. The POC concatenated values into markup, which makes a task title
 * containing `<` a rendering bug at best.
 *
 * Widths: every column has a minWidth and none shrinks, so with
 * `layout: 'fitDataFill'` a narrow widget gets a horizontal scroll bar rather
 * than squeezed columns. Title is frozen so it stays readable while scrolling
 * sideways; `#` is frozen with it because a row number that scrolls away is
 * useless.
 *
 * **These columns are deliberately provisional** - the user will add and remove
 * once the subtypes exist. Changing this file is the only change needed.
 */
define('IRSTasks/views/TaskColumns', [
    'IRSTasks/config/TaskFields',
    'JazzySole/Format'
], function (Fields, Format) {
    'use strict';

    /**
     * The cell keeps the platform's MQL name, so sorting and any state filter
     * still work; only what is DRAWN is the display name.
     *
     * `labelField` is the row key holding the display name the service resolved
     * - `typeNLS` / `stateNLS` where the platform sent them, our own label
     * otherwise. The column asks the row rather than the registry, so the name
     * set in DMC is what shows (user, 2026-10-07).
     */
    function badgeOf(labelField, labelOf, classOf) {
        return function (cell) {
            var value = cell.getValue();
            if (!value) { return Format.empty(); }
            var row = cell.getRow().getData();
            return Format.badge(row[labelField] || labelOf(value), classOf(value));
        };
    }

    function textOrDash(cell) {
        return cell.getValue() || Format.empty();
    }

    function dateCell(cell) {
        return Format.date(cell.getValue()) || Format.empty();
    }

    /**
     * @param {Function} onOpen  called with the row data when the title is clicked
     */
    return function columns(onOpen) {
        return [
            {
                title: '#', formatter: 'rownum', hozAlign: 'right',
                width: 45, minWidth: 45, headerSort: false, frozen: true
            },
            {
                title: 'Title', field: 'title', frozen: true,
                width: 240, minWidth: 170,
                cssClass: 'link-primary irs-link',
                tooltip: true,
                cellClick: function (e, cell) { onOpen(cell.getRow().getData()); }
            },
            {
                // wider than it was: the platform's names are long
                // ("PROJECT PERSONNEL / COST ESTIMATION") where ours were short
                title: 'Task Type', field: 'type', width: 230, minWidth: 150,
                formatter: badgeOf('typeLabel', Fields.typeLabel, Fields.typeBadge),
                tooltip: true
            },
            {
                title: 'Status', field: 'state', width: 130, minWidth: 110,
                formatter: badgeOf('stateLabel', Fields.stateLabel, Fields.stateBadge)
            },
            {
                title: 'Assigned To', field: 'assignedTo', width: 140, minWidth: 110,
                formatter: textOrDash
            },
            {
                // the project's NAME, which for an IRS project is its number;
                // the hover shows the title, because both do not fit a cell
                title: 'Project', field: 'projectName', width: 180, minWidth: 140,
                formatter: textOrDash,
                tooltip: function (e, cell) {
                    var row = cell.getRow().getData();
                    return row.projectTitle || row.projectName || '';
                }
            },
            {
                title: 'Department', field: 'department', width: 140, minWidth: 110,
                formatter: textOrDash
            },
            {
                title: 'Route', field: 'route', width: 150, minWidth: 120,
                formatter: textOrDash
            },
            {
                title: 'Route Task', field: 'routeTask', width: 150, minWidth: 120,
                formatter: textOrDash
            },
            {
                title: 'Action Required', field: 'actionRequired',
                width: 140, minWidth: 120,
                formatter: function (cell) {
                    var value = cell.getValue();
                    return value ? Format.badge(value, 'irs-action') : Format.empty();
                }
            },
            {
                title: 'Est. Finish', field: 'finish', width: 130, minWidth: 115,
                formatter: dateCell, sorter: 'string'
            }
        ];
    };
});
