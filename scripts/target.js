import { getConfigValue } from './configs.js';
import { getMetadata } from './aem.js';
export const EVENT_QUEUE = [];

function initWebSDK(path, config) {
    // Preparing the alloy queue
    if (!window.alloy) {
        // eslint-disable-next-line no-underscore-dangle
        (window.__alloyNS ||= []).push('alloy');
        window.alloy = (...args) => new Promise((resolve, reject) => {
            window.setTimeout(() => {
                window.alloy.q.push([resolve, reject, args]);
            });
        });
        window.alloy.q = [];
    }
    // Loading and configuring the websdk
    return new Promise((resolve) => {
        import(path)
            .then(() => window.alloy('configure', config))
            .then(resolve);
    });
}

function onDecoratedElement(fn) {
    // Apply propositions to all already decorated blocks/sections
    if (document.querySelector('[data-block-status="loaded"],[data-section-status="loaded"]')) {
        fn();
    }

    const observer = new MutationObserver((mutations) => {
        if (mutations.some((m) => m.target.tagName === 'BODY'
            || m.target.dataset.sectionStatus === 'loaded'
            || m.target.dataset.blockStatus === 'loaded')) {
            fn();
        }
    });
    // Watch sections and blocks being decorated async
    observer.observe(document.querySelector('main'), {
        subtree: true,
        attributes: true,
        attributeFilter: ['data-block-status', 'data-section-status'],
    });
    // Watch anything else added to the body
    observer.observe(document.querySelector('body'), { childList: true });
}

function toCssSelector(selector) {
    return selector.replace(/(\.\S+)?:eq\((\d+)\)/g, (_, clss, i) => `:nth-child(${Number(i) + 1}${clss ? ` of ${clss})` : ''}`);
}

async function getElementForProposition(proposition) {
    const selector = proposition.data.prehidingSelector
        || toCssSelector(proposition.data.selector);
    return document.querySelector(selector);
}

async function getAndApplyRenderDecisions() {
    const payload = {};
    const { propositions } = await window.alloy('sendEvent', {
        type: 'decisioning.propositionFetch',
        "personalization": {
            "sendDisplayEvent": false
        },
        renderDecisions: false,
        data: {
            __adobe: {
                target: payload,
            },
        },
        decisionScopes: ['__view__', 'target-html-block', 'target-json-block'],
    });
    const customPropositions = propositions?.filter((p) => p.scope !== '__view__');
    customPropositions?.forEach(({ scope, items, ...rest }) => {
        const existingDataIndex = EVENT_QUEUE.findIndex((e) => e.key === scope);
        if (existingDataIndex > -1) {
            EVENT_QUEUE[existingDataIndex] = {
                key: scope,
                data: items || [],
                ...rest,
            };
            return;
        }
        EVENT_QUEUE.push({
            key: scope,
            data: items || [],
            ...rest,
        });
    });
    onDecoratedElement(async () => {
        await window.alloy('applyPropositions', { propositions });
        // keep track of propositions that were applied
        propositions.forEach((p) => {
            p.items = p.items.filter((i) => i.schema !== 'https://ns.adobe.com/personalization/dom-action' || !getElementForProposition(i));
        });
    });

    // Reporting is deferred to avoid long tasks
    window.setTimeout(() => {
        // Report shown decisions
        window.alloy('sendEvent', {
            xdm: {
                eventType: 'decisioning.propositionDisplay',
                _experience: {
                    decisioning: { propositions },
                },
            },
        });
    });
}

const alloyLoadedPromise = (datastreamId, orgId) => initWebSDK('./alloy.js', {
    datastreamId,
    orgId,
});

export const loadAlloy = async () => {
    try {
        // const [datastreamId, orgId] = await Promise.all([
        //   getConfigValue('datastreamId'),
        //   getConfigValue('orgId'),
        // ]);
        const [datastreamId, orgId] = ['4e86b6a7-d213-498d-954c-e5ba10376bee', '75FC2BD458B967040A495C1E@AdobeOrg']

        if (!(orgId && datastreamId)) {
            console.error('Missing orgId or datastreamId');
            return;
        }

        if (getMetadata('target')) {
            await alloyLoadedPromise(datastreamId, orgId).catch((err) => {
                console.error('Error loading Alloy SDK:', err);
            });
            getAndApplyRenderDecisions();
        }
    } catch (error) {
        console.error('Error in loadAlloy:', error);
    }
}

