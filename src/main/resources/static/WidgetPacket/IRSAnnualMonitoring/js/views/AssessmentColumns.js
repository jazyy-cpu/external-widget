/**
 * Tabulator columns for the rounds grid.
 *
 * Kept apart from the view, as IRSProjects does, so changing what a grid shows
 * never means touching how it loads.
 *
 * Year, Period and the date range are custom attributes, and federated search
 * does not return them (WGT-10 api.md section 3.1). They are declared here
 * because the grid should have its final shape from the start - they simply
 * stay empty until the rows come from our REST service.
 */
define('IRSAnnualMonitoring/views/AssessmentColumns', [
    'IRSAnnualMonitoring/config/AssessmentFields'
], function (Fields) {
    'use strict';

    function stateFormatter(cell) {
        var value = cell.getValue();
        if (!value) { return ''; }
        var badge = document.createElement('span');
        badge.className = 'badge ' + (Fields.STATE_BADGE[value] || 'bg-secondary');
        badge.textContent = value;
        return badge;
    }

    return {
        build: function (options) {
            var opts = options || {};
            return [
                {
                    title: 'Title',
                    field: 'title',
                    minWidth: 220,
                    widthGrow: 3,
                    formatter: function (cell) {
                        var link = document.createElement('a');
                        link.href = '#';
                        link.className = 'text-decoration-none';
                        link.textContent = cell.getValue() || cell.getRow().getData().name || '(untitled)';
                        return link;
                    },
                    cellClick: function (e, cell) {
                        e.preventDefault();
                        if (opts.onOpen) { opts.onOpen(cell.getRow().getData()); }
                    }
                },
                { title: 'Code', field: 'name', width: 130 },
                { title: 'Year', field: 'year', width: 80, hozAlign: 'right' },
                { title: 'From', field: 'startDate', width: 110 },
                { title: 'To', field: 'endDate', width: 110 },
                {
                    title: 'Reports',
                    field: 'reports',
                    width: 110,
                    hozAlign: 'right',
                    formatter: function (cell) {
                        var row = cell.getRow().getData();
                        if (row.reports === undefined || row.reports === null || row.reports === '') { return ''; }
                        return row.reportsComplete + ' / ' + row.reports;
                    }
                },
                { title: 'State', field: 'state', width: 130, formatter: stateFormatter },
                { title: 'Modified', field: 'modified', width: 110 }
            ];
        }
    };
});
