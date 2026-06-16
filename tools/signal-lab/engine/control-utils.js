(function(global) {
    'use strict';

    function clampNumber(value, min, max, step) {
        let num = Number(value);
        if (!Number.isFinite(num)) {
            num = min;
        }
        num = Math.max(min, Math.min(max, num));
        if (step && step > 0) {
            num = Math.round(num / step) * step;
            num = Math.max(min, Math.min(max, num));
        }
        return num;
    }

    function isPercentRangeControl(control) {
        if (!control || control.type !== 'range') {
            return false;
        }
        const key = control.key;
        return key === 'volume' || key === 'clickVolume'
            || key === 'logoOpacity' || key === 'textOpacity'
            || key === 'textWatermarkOpacity' || key === 'logoWatermarkOpacity';
    }

    function rangeToDisplay(value, control) {
        if (isPercentRangeControl(control)) {
            return Math.round(value * 100);
        }
        if (control.step && control.step < 1) {
            return Number(Number(value).toFixed(2));
        }
        return Math.round(value);
    }

    function displayToRange(displayValue, control) {
        if (isPercentRangeControl(control)) {
            return clampNumber(displayValue / 100, control.min, control.max, control.step);
        }
        return clampNumber(displayValue, control.min, control.max, control.step);
    }

    function formatRangeLabel(value, control) {
        if (isPercentRangeControl(control)) {
            return `${Math.round(value * 100)}%`;
        }
        const unit = control.unit || '';
        const display = rangeToDisplay(value, control);
        return `${display}${unit}`;
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.ControlUtils = {
        clampNumber,
        isPercentRangeControl,
        rangeToDisplay,
        displayToRange,
        formatRangeLabel
    };
})(typeof window !== 'undefined' ? window : globalThis);
