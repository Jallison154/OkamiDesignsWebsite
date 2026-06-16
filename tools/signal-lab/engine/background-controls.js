(function(global) {
    'use strict';

    const GRID_INTENSITY_TYPES = new Set([
        'technical-grid',
        'technical-blueprint',
        'hex-pattern',
        'carbon-fiber'
    ]);

    function hasGridIntensity(settings = {}) {
        const type = settings.backgroundType || 'technical-grid';
        return settings.backgroundEnabled !== false && type !== 'none' && GRID_INTENSITY_TYPES.has(type);
    }

    function getBackgroundControlSchema() {
        const types = global.OkamiSignalLab?.TechnicalBackground?.BACKGROUND_TYPES || [];

        return [
            {
                section: 'background',
                type: 'checkbox',
                key: 'backgroundEnabled',
                label: 'Enable Background'
            },
            {
                section: 'background',
                type: 'select',
                key: 'backgroundType',
                label: 'Background Type',
                options: types.map((entry) => ({ value: entry.id, label: entry.label })),
                enabledWhen: (settings) => settings.backgroundEnabled !== false
            },
            {
                section: 'background',
                type: 'range',
                key: 'backgroundOpacity',
                label: 'Background Opacity',
                min: 0,
                max: 100,
                step: 1,
                unit: '%',
                enabledWhen: (settings) => settings.backgroundEnabled !== false
                    && (settings.backgroundType || 'technical-grid') !== 'none'
            },
            {
                section: 'background',
                type: 'range',
                key: 'gridIntensity',
                label: 'Grid Intensity',
                min: 0,
                max: 100,
                step: 1,
                unit: '%',
                enabledWhen: (settings) => hasGridIntensity(settings)
            }
        ];
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.BackgroundControls = {
        GRID_INTENSITY_TYPES,
        hasGridIntensity,
        getBackgroundControlSchema
    };
})(typeof window !== 'undefined' ? window : globalThis);
