// store configs globally to avoid multiple requests
window.configsPromises = {};

function getOrigin() {
    const { location } = window;
    return location.href === 'about:srcdoc' ? window.parent.location.origin : location.origin;
}

function buildConfigURL() {
    const origin = getOrigin();
    let configFileName = 'configs.json';
    const configURL = new URL(`${origin}/${configFileName}`);

    return configURL;
}

const getStoredConfig = () => {
    const configKey = 'config';

    return window.sessionStorage.getItem(configKey);
};

const storeConfig = (configJSON) => {
    const configKey = 'config';

    return window.sessionStorage.setItem(configKey, configJSON);
};

const getConfig = async () => {
    let configJSON = getStoredConfig();

    if (!configJSON) {
        const fetchGlobalConfig = fetch(buildConfigURL());
        try {
            const response = await fetchGlobalConfig;

            // Extract JSON data from responses
            configJSON = await response.text();

            storeConfig(configJSON);
        } catch (e) {
            console.error('no config loaded', e);
        }
    }

    // merge config and locale config
    const config = JSON.parse(configJSON);

    return config;
};

export const getConfigValue = async (configParam) => {
    window.configsPromises = getConfig();

    const configJSON = await window.configsPromises;
    const configElements = configJSON.data;

    return configElements.find((c) => c.key === configParam)?.value;
};