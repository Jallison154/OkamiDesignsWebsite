(function() {
    'use strict';

    /**
     * Shim — shared/registry/pages.js must load before this file (see HTML script order).
     * Kept for backward compatibility with pages that only reference page-registry.js.
     */
    if (!window.OkamiPageRegistry || !window.OkamiShared?.Registry) {
        console.error(
            'Okami page registry missing. Include shared/settings/site-settings.js, ' +
            'shared/registry/pages.js, and shared/visibility/access-policy.js before page-registry.js.'
        );
    }
})();
