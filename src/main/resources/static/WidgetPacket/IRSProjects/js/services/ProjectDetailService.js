/**
 * One project, for the detail page (WGT-04).
 *
 *   GET <3DSpace>/resources/v1/modeler/projects/{id}?$include=none
 *
 * No `$fields`: api.md section 2 recorded that **every EPM attribute comes back
 * in `dataelements` automatically**, with no extra parameter. The landing page
 * trims the payload because it lists many rows; here we want one object whole,
 * and a `$fields` list would have to be kept in step with `ProjectForm` for no
 * gain.
 *
 * `$include=none` is still mandatory - the default expands the whole task tree.
 */
define('IRSProjects/services/ProjectDetailService', [
    'JazzySole/Request',
    'IRSProjects/config/ProjectFields'
], function (Request, Fields) {
    'use strict';

    var PATH = 'resources/v1/modeler/projects/';

    function value(item, name) {
        var de = item.dataelements || {};
        return de[name] !== undefined ? de[name] : item[name];
    }

    /**
     * The detail service answers with the same envelope as the list, so a
     * single-object response may arrive as `data: [ {...} ]` or as the object
     * itself. Both are accepted rather than betting on one.
     */
    function first(body) {
        if (!body) { return null; }
        if (Array.isArray(body.data)) { return body.data[0] || null; }
        if (body.data && typeof body.data === 'object') { return body.data; }
        return (body.id || body.dataelements) ? body : null;
    }

    function toProject(item) {
        var type = item.type || value(item, 'type') || '';
        return {
            id: item.id || value(item, 'id') || '',
            type: type,
            category: Fields.typeLabel(type),
            projectNo: value(item, 'EPMProjectNo') || '',
            title: value(item, 'title') || '',
            state: value(item, 'state') || '',
            start: value(item, 'estimatedStartDate') || '',
            finish: value(item, 'estimatedFinishDate') || '',
            description: value(item, 'description') || '',
            percentComplete: value(item, 'percentComplete'),
            /** every attribute as returned, so ProjectForm decides what to show */
            data: item.dataelements || {},
            raw: item
        };
    }

    return {
        /**
         * @param {string} id  the project's physical id
         * @returns {Promise<Object>} the mapped project
         */
        get: function (id) {
            if (!id) { return Promise.reject(new Error('No project id given.')); }
            return Request.get(PATH + encodeURIComponent(id), {
                params: { '$include': 'none' }
            }).then(function (body) {
                var item = first(body);
                if (!item) {
                    throw new Error('Project ' + id + ' was not found, or is not visible ' +
                                    'with the active credential.');
                }
                return toProject(item);
            });
        },

        /** for tests only */
        _toProject: toProject,
        _first: first
    };
});
