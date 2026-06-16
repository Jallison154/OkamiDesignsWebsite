(function(global) {
    'use strict';

    function normalizeForSearch(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[^a-z0-9%]+/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');
    }

    function compactForSearch(text) {
        return normalizeForSearch(text).replace(/\s/g, '');
    }

    function matchesQuery(haystack, query) {
        const normalizedQuery = normalizeForSearch(query);
        if (!normalizedQuery) {
            return true;
        }

        const normalizedHaystack = normalizeForSearch(haystack);
        if (normalizedHaystack.includes(normalizedQuery)) {
            return true;
        }

        const compactQuery = compactForSearch(query);
        const compactHaystack = compactForSearch(haystack);
        if (compactQuery && compactHaystack.includes(compactQuery)) {
            return true;
        }

        const tokens = normalizedQuery.split(' ').filter(Boolean);
        return tokens.every((token) => normalizedHaystack.includes(token)
            || compactHaystack.includes(token));
    }

    function appendTerms(terms, value) {
        const normalized = normalizeForSearch(value);
        if (normalized) {
            terms.push(normalized);
        }
        const compact = compactForSearch(value);
        if (compact && compact !== normalized) {
            terms.push(compact);
        }
    }

    function buildCatalogTerms(catalog, extraKeys = []) {
        const terms = [];
        catalog.forEach((entry) => {
            appendTerms(terms, entry.id);
            appendTerms(terms, entry.label);
            extraKeys.forEach((key) => appendTerms(terms, entry[key]));
        });
        return terms;
    }

    function buildModuleSearchIndex() {
        const registry = global.OkamiSignalLab?.ModuleRegistry;
        if (!registry) {
            return [];
        }

        const index = [];

        registry.getCatalog().forEach((entry) => {
            if (entry.status !== 'active') {
                return;
            }

            const terms = [];
            const items = [];

            appendTerms(terms, entry.id);
            appendTerms(terms, entry.label);
            appendTerms(terms, entry.description);
            appendTerms(terms, entry.category);

            if (entry.id === 'video-patterns') {
                appendTerms(terms, 'video pattern patterns color bars smpte calibration test pattern okami calibration alignment focus convergence siemens');
                (global.OkamiSignalLab.PATTERN_CATALOG || []).forEach((pattern) => {
                    const itemTerms = [pattern.id, pattern.label, 'color bars', 'bars'];
                    if (pattern.id === 'okami-calibration') {
                        itemTerms.push('default calibration test pattern alignment focus color scale crosshair safe area');
                    }
                    if (pattern.id === 'smpte-bars') {
                        itemTerms.push('smpte colorbars color bars');
                    }
                    if (pattern.id.includes('grid')) {
                        itemTerms.push('grid');
                    }
                    const itemHaystack = itemTerms.join(' ');
                    appendTerms(terms, itemHaystack);
                    items.push({
                        label: pattern.label,
                        haystack: itemHaystack,
                        statePatch: { patternId: pattern.id }
                    });
                });
            }

            if (entry.id === 'motion-patterns') {
                appendTerms(terms, 'motion animation moving ball refresh latency');
                (global.OkamiSignalLab.MOTION_CATALOG || []).forEach((pattern) => {
                    const itemHaystack = `${pattern.id} ${pattern.label} motion`;
                    appendTerms(terms, itemHaystack);
                    items.push({
                        label: pattern.label,
                        haystack: itemHaystack,
                        statePatch: { patternId: pattern.id }
                    });
                });
            }

            if (entry.id === 'audio-tools') {
                appendTerms(terms, 'audio generator tone noise meter pink white hz khz');
                (global.OkamiSignalLab.SOURCE_CATALOG || []).forEach((source) => {
                    const itemHaystack = [
                        source.id,
                        source.label,
                        source.frequency,
                        source.label.replace(/hz/gi, ' hz'),
                        source.id.replace(/-/g, ' ')
                    ].join(' ');
                    appendTerms(terms, itemHaystack);
                    items.push({
                        label: source.label,
                        haystack: itemHaystack,
                        statePatch: { sourceId: source.id }
                    });
                });
            }

            if (entry.id === 'sync-tools') {
                appendTerms(terms, 'sync av latency flash click frame timecode ball');
                (global.OkamiSignalLab.MODE_CATALOG || []).forEach((mode) => {
                    const itemHaystack = `${mode.id} ${mode.label} sync av`;
                    appendTerms(terms, itemHaystack);
                    items.push({
                        label: mode.label,
                        haystack: itemHaystack,
                        statePatch: { mode: mode.id }
                    });
                });
            }

            if (entry.id === 'led-utilities') {
                appendTerms(terms, 'led wall panel cabinet pixel resolution aspect ratio scaling grid mapping');
            }

            if (entry.id === 'export') {
                appendTerms(terms, 'export download png jpg jpeg watermark resolution 4k 8k pattern render');
            }

            if (entry.id === 'branding') {
                appendTerms(terms, 'branding logo overlay text watermark identity');
            }

            if (entry.id === 'display-info') {
                appendTerms(terms, 'display information screen viewport refresh rate pixel ratio fullscreen');
            }

            if (entry.id === 'welcome') {
                appendTerms(terms, 'signal check welcome test foundation smpte');
            }

            index.push({
                moduleId: entry.id,
                label: entry.label,
                category: entry.category,
                haystack: terms.join(' '),
                items
            });
        });

        return index;
    }

    function findBestItemMatch(items, query) {
        if (!query || !items.length) {
            return null;
        }

        let best = null;
        items.forEach((item) => {
            if (!matchesQuery(item.haystack, query)) {
                return;
            }
            const score = compactForSearch(query).length;
            if (!best || score >= best.score) {
                best = { ...item, score };
            }
        });
        return best;
    }

    function filterModules(query, index = buildModuleSearchIndex()) {
        const normalizedQuery = normalizeForSearch(query);
        if (!normalizedQuery) {
            return index.map((entry) => ({
                moduleId: entry.moduleId,
                label: entry.label,
                category: entry.category,
                matchLabel: null,
                statePatch: null
            }));
        }

        return index
            .filter((entry) => matchesQuery(entry.haystack, normalizedQuery))
            .map((entry) => {
                const bestItem = findBestItemMatch(entry.items, normalizedQuery);
                return {
                    moduleId: entry.moduleId,
                    label: entry.label,
                    category: entry.category,
                    matchLabel: bestItem?.label || null,
                    statePatch: bestItem?.statePatch || null
                };
            });
    }

    global.OkamiSignalLab = global.OkamiSignalLab || {};
    global.OkamiSignalLab.ModuleSearch = {
        normalizeForSearch,
        matchesQuery,
        buildModuleSearchIndex,
        filterModules
    };
})(typeof window !== 'undefined' ? window : globalThis);
