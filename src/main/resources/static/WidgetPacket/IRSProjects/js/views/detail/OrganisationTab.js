/**
 * Organisation - who the project belongs to and who it is for (WGT-04).
 *
 * Two links, both agreed in WP02 doc 05 and **neither built on the platform
 * yet**, so this tab is a skeleton that states exactly what is missing:
 *
 *   Department  IRSDepartmentProject : Department -> project, one to many,
 *               mirroring the OOTB `Business Unit Project` (doc 05 section 8.4,
 *               option 3). The department's parent Business Unit is what makes
 *               the stream derivable, so the BU is shown next to it.
 *   Customer    IRSProjectCustomer : the customer is a `Company` object and every
 *               customer field on the form - name, city, country, phone, e-mail -
 *               already exists on it (doc 05 section 9.2). The link must also
 *               accept Business Unit and Department, because an internal
 *               department can be the client (doc 05 section 9.4).
 *
 * Open before this becomes real (doc 05 section 9.5): Q18 when the link is made
 * (at creation, or afterwards), Q19 how (OOTB add-existing, our own picker, or
 * automatically from the creator's department), Q20 whether changing it later
 * needs control.
 */
define('IRSProjects/views/detail/OrganisationTab', [
    'IRSProjects/components/FieldList'
], function (FieldList) {
    'use strict';

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    return {
        render: function (pane, project) {
            pane.appendChild(el('div', 'text-body-secondary mb-3',
                'Form section II (Customer) and the form header (Department). ' +
                'Both are relationships, not fields.'));

            FieldList.placeholder(pane, 'Department and Business Unit', [
                'The relationship IRSDepartmentProject does not exist on the platform yet.',
                'One department per project, linked to the Department master from WP01. ' +
                'Its parent Business Unit gives the stream (R&D, AR, RD, EAF), so the two ' +
                'must never disagree.',
                'Still to settle: whether the Business Unit is set automatically from the ' +
                'department, and whether one department per project is always right.'
            ]);

            var gap = el('div', 'mt-3');
            pane.appendChild(gap);

            FieldList.placeholder(gap, 'Customer', [
                'The relationship IRSProjectCustomer does not exist on the platform yet.',
                'The customer is a Company object; name, city, country, contact number and ' +
                'e-mail address are all already on it, so nothing is copied onto the project.',
                'The link must also accept a Business Unit or a Department: an internal ' +
                'department can be the client.'
            ]);

            var when = el('div', 'mt-3 alert alert-secondary small mb-0');
            when.appendChild(el('div', 'fw-semibold', 'Not decided yet'));
            when.appendChild(el('div', null,
                'When the project is linked to its department and customer (at creation, or ' +
                'afterwards from this tab), how it is picked, and whether changing it later ' +
                'needs an approval. Until that is settled this tab stays read-only.'));
            pane.appendChild(when);

            return pane;
        }
    };
});
