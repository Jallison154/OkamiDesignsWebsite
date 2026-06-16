(function(global) {
    'use strict';

    function mount(options = {}) {
        const host = document.querySelector('.signal-lab-header-meta')
            || document.querySelector('.signal-lab-heading');
        if (!host || host.querySelector('[data-okami-license-panel]')) {
            return;
        }

        const client = global.OkamiCommercialClient;
        if (!client) {
            return;
        }

        const panel = document.createElement('details');
        panel.className = 'okami-license-panel';
        panel.setAttribute('data-okami-license-panel', 'true');
        panel.innerHTML = `
            <summary class="okami-license-panel-summary">License</summary>
            <div class="okami-license-panel-body">
                <label class="okami-license-panel-label" for="okami-license-key-input">License key</label>
                <input type="password" id="okami-license-key-input" class="okami-license-panel-input"
                    placeholder="Enter license key" autocomplete="off" spellcheck="false">
                <button type="button" class="led-btn led-btn-secondary okami-license-panel-btn">Activate</button>
                <button type="button" class="led-btn led-btn-text okami-license-panel-clear">Sign out</button>
                <p class="okami-license-panel-status" hidden></p>
            </div>
        `;

        const input = panel.querySelector('#okami-license-key-input');
        const button = panel.querySelector('.okami-license-panel-btn');
        const clearBtn = panel.querySelector('.okami-license-panel-clear');
        const status = panel.querySelector('.okami-license-panel-status');

        button.addEventListener('click', async () => {
            const licenseKey = input.value.trim();
            if (!licenseKey) {
                status.hidden = false;
                status.textContent = 'Enter a license key.';
                return;
            }

            button.disabled = true;
            status.hidden = false;
            status.textContent = 'Verifying…';

            try {
                const entitlements = await client.activateLicense(options.productId, licenseKey);
                status.textContent = `Activated — ${entitlements.tierLabel || entitlements.tier} tier.`;
                if (typeof options.onActivated === 'function') {
                    await options.onActivated(entitlements);
                }
            } catch (error) {
                status.textContent = error.message || 'Activation failed.';
            } finally {
                button.disabled = false;
            }
        });

        clearBtn.addEventListener('click', async () => {
            clearBtn.disabled = true;
            status.hidden = false;
            status.textContent = 'Signing out…';
            try {
                await client.clearLicense();
                input.value = '';
                status.textContent = 'Signed out — free tier restored.';
                if (typeof options.onActivated === 'function') {
                    await options.onActivated(null);
                }
            } catch (error) {
                status.textContent = error.message || 'Could not clear license.';
            } finally {
                clearBtn.disabled = false;
            }
        });

        host.appendChild(panel);
    }

    global.OkamiCommercialLicensePanel = { mount };
})(typeof window !== 'undefined' ? window : globalThis);
