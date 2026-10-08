/**
 * Tabulator column definitions for the approvals list.
 *
 * A deliberately different set from `TaskColumns`, because an inbox task
 * answers different questions. A task row asks *"what is this piece of work"*;
 * an approval row asks *"what is being asked of me, on what, and by when"*.
 *
 *     #  Role  On task  Task Type  Task Status  Action  Due  Route
 *
 * What is NOT here, and why:
 *
 *   - **No `Title` column.** An inbox task's own title IS the role ("Project
 *     Manager"), so a Title column would repeat Role exactly.
 *   - **No `Assigned To`.** With `currentTaskFilter=assigned` every row is the
 *     signed-in user's, so a column of their own name says nothing. It is kept
 *     in the row data, because the caveat in `InboxTaskService` means that may
 *     not stay true.
 *   - **No decision or comment.** The list shows what is WAITING; a decided
 *     step is history, and the task page's approval chain already shows it with
 *     the signature.
 *
 * **`On task` is the link, not the role.** What an approver wants to open is
 * the thing being approved - the custom task, with its form, its documents and
 * its approval chain. The inbox task itself has nothing to show that this row
 * does not already say. So the row's one target is the connected task.
 */
define('IRSTasks/views/InboxColumns', [
    'IRSTasks/config/TaskFields',
    'JazzySole/Format'
], function (Fields, Format) {
    'use strict';

    function textOrDash(cell) {
        return cell.getValue() || Format.empty();
    }

    function dateCell(cell) {
        return Format.date(cell.getValue()) || Format.empty();
    }

    /** The connected task's type and state, drawn with the task grid's badges. */
    function connectedBadge(labelField, classOf) {
        return function (cell) {
            var value = cell.getValue();
            if (!value) { return Format.empty(); }
            var row = cell.getRow().getData();
            return Format.badge(row[labelField] || value, classOf(value));
        };
    }

    /**
     * @param {Function} onOpen called with the row data when `On task` is
     *        clicked. The caller opens `row.connectedId` - the CUSTOM task.
     */
    return function columns(onOpen) {
        return [
            {
                title: '#', formatter: 'rownum', hozAlign: 'right',
                width: 50, minWidth: 50, frozen: true, headerSort: false
            },
            {
                // the role the step stands for, which is the inbox task's title
                title: 'Role', field: 'role', frozen: true,
                width: 170, minWidth: 130,
                formatter: textOrDash, tooltip: true
            },
            {
                // the link: it opens the CUSTOM task, not the inbox task
                title: 'On task', field: 'connectedName', frozen: true,
                width: 190, minWidth: 150,
                cssClass: 'link-primary irs-link',
                tooltip: true,
                formatter: textOrDash,
                cellClick: function (e, cell) { onOpen(cell.getRow().getData()); }
            },
            {
                title: 'Task Type', field: 'connectedType',
                width: 230, minWidth: 150,
                formatter: connectedBadge('connectedTypeLabel', Fields.typeBadge),
                tooltip: true
            },
            {
                // the connected task's state, not the inbox task's - "In
                // Approval" is the useful fact; the inbox task's own "Assign"
                // is just a restatement of the row existing
                title: 'Task Status', field: 'connectedState',
                width: 140, minWidth: 110,
                formatter: textOrDash
            },
            {
                title: 'Action', field: 'action', width: 130, minWidth: 110,
                formatter: function (cell) {
                    var value = cell.getValue();
                    return value ? Format.badge(value, 'warning') : Format.empty();
                }
            },
            {
                title: 'Due', field: 'dueDate', width: 130, minWidth: 115,
                formatter: dateCell, sorter: 'string'
            },
            {
                title: 'Route', field: 'routeName', width: 260, minWidth: 150,
                formatter: textOrDash, tooltip: true
            }
        ];
    };
});
