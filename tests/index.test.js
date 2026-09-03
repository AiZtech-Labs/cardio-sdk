/**
 * Tests for the cardio SDK (src/index.js).
 *
 * The module keeps a singleton `instance`, so every test loads a fresh copy through
 * jest.isolateModules(). `fetch` is replaced per test with a route-based mock so the same
 * endpoint can answer differently across calls (initialize() and startCardioTest() both hit
 * orgStatus).
 */

// src/config.js reads these when the module is evaluated, so they must exist before any load.
process.env.BACKEND_URL = 'https://api.test';
process.env.FRONTEND_URL = 'https://app.test';

const { setImmediate: realSetImmediate } = require('timers');

const VERIFY_URL = 'https://api.test/sdk/central/verify';
const TOKEN_VERIFY_URL = 'https://api.test/sdk/central/access-token/verify';
const ORG_STATUS_URL = 'https://api.test/sdk/central/orgStatus';
const SUBSCRIPTIONS_URL = 'https://api.test/subscription/central/sdk/org1/list';
const REFRESH_URL = 'https://api.test/sdk/central/access-token/refresh';

const NOT_JSON = Symbol('not-json');

const ORG = { _id: 'org1', name: 'Test Org', accountType: 'free' };
const VERIFIED = { status: 200, body: { success: true, organization: ORG } };
const FREE_STATUS = { status: 200, body: { data: { accountType: 'free', totalCardioTestCount: 0 } } };
const NO_SUBS = { status: 200, body: { subscriptions: [] } };

const API_KEY_CONFIG = { apiKey: 'key-1', appUserId: 'user-1' };
const ACCESS_TOKEN_CONFIG = {
    apiKey: 'token-1',
    appUserId: 'user-1',
    organizationId: 'org1',
    verificationMethod: 'accessToken', // mixed case on purpose: the option is case-insensitive
};

function jsonResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => {
            if (body === NOT_JSON) throw new SyntaxError('Unexpected token < in JSON at position 0');
            return body;
        },
    };
}

// Install a route-based fetch mock. Each route is a response spec `{ status, body }`, an Error
// (the request fails at the network level), or a function `(url, init) => spec` so a test can
// change what an endpoint answers between calls.
function mockFetch(routes) {
    const fetchMock = jest.fn(async (url, init) => {
        let key = null;
        if (url === VERIFY_URL || url === TOKEN_VERIFY_URL) key = 'verify';
        else if (url === ORG_STATUS_URL) key = 'orgStatus';
        else if (url.startsWith('https://api.test/subscription/central/sdk/')) key = 'subscriptions';
        else if (url === REFRESH_URL) key = 'refresh';

        const route = key && routes[key];
        if (!route) throw new Error(`Unexpected fetch: ${url}`);
        const spec = typeof route === 'function' ? route(url, init) : route;
        if (spec instanceof Error) throw spec;
        return jsonResponse(spec.status, spec.body);
    });
    global.fetch = fetchMock;
    return fetchMock;
}

function loadSdk() {
    let mod;
    jest.isolateModules(() => {
        mod = require('../src/index.js');
    });
    return mod;
}

async function initSdk(config, routes) {
    const fetchMock = mockFetch(routes);
    const mod = loadSdk();
    const sdk = await mod.default(config);
    return { mod, sdk, fetchMock };
}

const calledUrls = (fetchMock) => fetchMock.mock.calls.map(([url]) => url);

// Waits until every pending microtask has run (the mocked fetch never touches I/O, so one real
// setImmediate is enough for startTest() to reach createIframe()).
const flush = () => new Promise((resolve) => realSetImmediate(resolve));

const postFromIframe = (payload) => window.dispatchEvent(new MessageEvent('message', { data: payload }));

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
});

describe('ERROR_CODES', () => {
    test('AIZERR006 is an alias of AIZERR005 and AIZERR011 exists', () => {
        const { ERROR_CODES } = loadSdk();
        expect(ERROR_CODES.AIZERR006).toBe(ERROR_CODES.AIZERR005);
        expect(ERROR_CODES.AIZERR006.code).toBe('AIZERR005');
        expect(ERROR_CODES.AIZERR005.code).toBe('AIZERR005');
        expect(ERROR_CODES.AIZERR011).toEqual({ code: 'AIZERR011', note: 'Test cancelled' });
        expect(ERROR_CODES.AIZERR010).toEqual({ code: 'AIZERR010', note: 'Product not entitled' });
    });
});

describe('initialize — verification', () => {
    test('apikey happy path: verify 200 → orgStatus free → subscription list', async () => {
        const { sdk, fetchMock } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: FREE_STATUS,
            subscriptions: NO_SUBS,
        });

        expect(sdk.success).toBe(true);
        expect(sdk.isAvailable).toEqual({ value: true, message: 'Free account' });
        expect(typeof sdk.startCardioTest).toBe('function');
        expect(typeof sdk.closeTest).toBe('function');

        expect(calledUrls(fetchMock)).toEqual([VERIFY_URL, ORG_STATUS_URL, SUBSCRIPTIONS_URL]);
        const [, verifyInit] = fetchMock.mock.calls[0];
        expect(verifyInit.method).toBe('GET');
        expect(verifyInit.headers['X-Api-Key']).toBe('key-1');
        const [, statusInit] = fetchMock.mock.calls[1];
        expect(statusInit.method).toBe('POST');
        expect(JSON.parse(statusInit.body)).toEqual({ organizationId: 'org1' });
    });

    test('verify 401 with a non-JSON body (apikey) → AIZERR009', async () => {
        const { sdk, fetchMock } = await initSdk(API_KEY_CONFIG, {
            verify: { status: 401, body: NOT_JSON },
        });

        expect(sdk.success).toBe(false);
        expect(sdk.isAvailable).toEqual({ value: false, message: 'Invalid API key', code: 'AIZERR009' });
        expect(sdk.message).toBe('Invalid API key');
        expect(calledUrls(fetchMock)).toEqual([VERIFY_URL]); // no further calls after a failed verify
    });

    test('verify 401 (accesstoken) → AIZERR008 and the token is POSTed in the body', async () => {
        const { sdk, fetchMock } = await initSdk(ACCESS_TOKEN_CONFIG, {
            verify: { status: 401, body: { success: false, message: 'Unauthorized' } },
        });

        expect(sdk.success).toBe(false);
        expect(sdk.isAvailable.code).toBe('AIZERR008');
        expect(sdk.isAvailable.message).toBe('Invalid access token');
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(TOKEN_VERIFY_URL);
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({ access_token: 'token-1', organizationId: 'org1' });
    });

    test('2xx with success:false keeps the existing code mapping', async () => {
        const { sdk, fetchMock } = await initSdk(API_KEY_CONFIG, {
            verify: {
                status: 200,
                body: { success: false, message: 'Verification failed across all regions. Invalid public key or domain.' },
            },
        });

        expect(sdk.success).toBe(false);
        expect(sdk.isAvailable.value).toBe(false);
        expect(sdk.isAvailable.code).toBe('AIZERR009');
        expect(calledUrls(fetchMock)).toEqual([VERIFY_URL]);
    });

    test('network failure on verify → coded failure, no throw', async () => {
        const { sdk } = await initSdk(ACCESS_TOKEN_CONFIG, {
            verify: new TypeError('Failed to fetch'),
        });

        expect(sdk.success).toBe(false);
        expect(sdk.isAvailable.code).toBe('AIZERR008');
    });
});

describe('initialize — organization status and subscriptions', () => {
    test('orgStatus 401 in accesstoken mode → AIZERR008, no throw or hang', async () => {
        const { sdk, fetchMock } = await initSdk(ACCESS_TOKEN_CONFIG, {
            verify: VERIFIED,
            orgStatus: { status: 401, body: { message: 'Token expired' } },
            subscriptions: NO_SUBS,
        });

        expect(sdk.success).toBe(false);
        expect(sdk.isAvailable).toEqual({ value: false, message: 'Token expired', code: 'AIZERR008' });
        expect(sdk.message).toBe('Token expired');
        expect(calledUrls(fetchMock)).toEqual([TOKEN_VERIFY_URL, ORG_STATUS_URL]);
    });

    test('orgStatus 403 in apikey mode → AIZERR009', async () => {
        const { sdk } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: { status: 403, body: NOT_JSON },
        });

        expect(sdk.isAvailable).toEqual({
            value: false,
            message: 'Failed to fetch organization status.',
            code: 'AIZERR009',
        });
    });

    test('orgStatus 500 → AIZERR004 carrying the server message', async () => {
        const { sdk } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: { status: 500, body: { message: 'Internal error' } },
        });

        expect(sdk.isAvailable).toEqual({ value: false, message: 'Internal error', code: 'AIZERR004' });
    });

    test('orgStatus 404 → AIZERR007 (the organization the credential names does not exist)', async () => {
        const { sdk } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: { status: 404, body: { success: false, message: 'Organization not found' } },
        });

        expect(sdk.isAvailable).toEqual({ value: false, message: 'Organization not found', code: 'AIZERR007' });
    });

    test('subscription list 401 → AIZERR009 in apikey mode', async () => {
        const { sdk } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: { status: 200, body: { data: { accountType: 'active', totalCardioTestCount: 0 } } },
            subscriptions: { status: 401, body: {} },
        });

        expect(sdk.isAvailable).toEqual({
            value: false,
            message: 'Failed to fetch subscription list.',
            code: 'AIZERR009',
        });
    });

    test('`{ subscriptions: null }` on an active account → AIZERR003, no TypeError', async () => {
        const { sdk } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: {
                status: 200,
                body: {
                    data: {
                        accountType: 'active',
                        totalCardioTestCount: 0,
                        testLimitByCurrentSubscription: { cardio: { testLimit: { interval_count: 1, unit: 100 } } },
                    },
                },
            },
            subscriptions: { status: 200, body: { subscriptions: null } },
        });

        expect(sdk.success).toBe(false);
        expect(sdk.isAvailable).toEqual({
            value: false,
            message: 'Active subscription usage limit exceeded',
            code: 'AIZERR003',
        });
    });

    test('active account without testLimitByCurrentSubscription → AIZERR003, no TypeError', async () => {
        const { sdk } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: { status: 200, body: { data: { accountType: 'active', totalCardioTestCount: 0 } } },
            subscriptions: {
                status: 200,
                body: { subscriptions: [{ productType: 'cardio', stripe: { status: 'active' } }] },
            },
        });

        expect(sdk.isAvailable.code).toBe('AIZERR003');
    });

    test('active account with remaining tests and an active cardio subscription → allowed', async () => {
        const { sdk } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: {
                status: 200,
                body: {
                    data: {
                        accountType: 'active',
                        totalCardioTestCount: 10,
                        testLimitByCurrentSubscription: { cardio: { testLimit: { interval_count: 1, unit: 100 } } },
                    },
                },
            },
            subscriptions: {
                status: 200,
                body: {
                    subscriptions: [
                        { productType: 'ecg', stripe: { status: 'active' } },
                        { productType: 'cardio', stripe: { status: 'active' } },
                    ],
                },
            },
        });

        expect(sdk.success).toBe(true);
        expect(sdk.isAvailable).toEqual({ value: true, message: 'Active subscription' });
    });

    test('unknown account type → AIZERR004', async () => {
        const { sdk } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: { status: 200, body: { data: { accountType: 'suspended' } } },
            subscriptions: NO_SUBS,
        });

        expect(sdk.isAvailable).toEqual({ value: false, message: 'No active subscription', code: 'AIZERR004' });
    });
});

describe('entitlementSource: rbac', () => {
    const RBAC_CONFIG = { ...API_KEY_CONFIG, entitlementSource: 'rbac' };
    const withEntitlement = (entitlement) => ({
        status: 200,
        body: { data: { accountType: 'trial', totalCardioTestCount: 0, entitlement } },
    });

    test('enforce + entitled:false + reason trial_expired → AIZERR001', async () => {
        const { sdk, fetchMock } = await initSdk(RBAC_CONFIG, {
            verify: VERIFIED,
            orgStatus: withEntitlement({
                mode: 'enforce',
                products: { cardio: { entitled: false, reason: 'trial_expired' } },
            }),
            subscriptions: NO_SUBS,
        });

        expect(sdk.isAvailable).toEqual({ value: false, message: 'Trial expired', code: 'AIZERR001' });
        expect(calledUrls(fetchMock)).not.toContain(SUBSCRIPTIONS_URL);
    });

    test('enforce + entitled:false without a reason → AIZERR010', async () => {
        const { sdk } = await initSdk(RBAC_CONFIG, {
            verify: VERIFIED,
            orgStatus: withEntitlement({ mode: 'enforce', products: { cardio: { entitled: false } } }),
            subscriptions: NO_SUBS,
        });

        expect(sdk.isAvailable).toEqual({ value: false, message: 'Product not entitled', code: 'AIZERR010' });
    });

    test('enforce + entitled:true, remaining:0, unlimited:false → AIZERR002', async () => {
        const { sdk } = await initSdk(RBAC_CONFIG, {
            verify: VERIFIED,
            orgStatus: withEntitlement({
                mode: 'enforce',
                products: { cardio: { entitled: true, remaining: 0, unlimited: false } },
            }),
            subscriptions: NO_SUBS,
        });

        expect(sdk.isAvailable).toEqual({ value: false, message: 'Usage limit exceeded', code: 'AIZERR002' });
    });

    test('enforce + entitled:true with remaining tests → allowed', async () => {
        const { sdk } = await initSdk(RBAC_CONFIG, {
            verify: VERIFIED,
            orgStatus: withEntitlement({
                mode: 'enforce',
                products: { cardio: { entitled: true, remaining: 3, unlimited: false } },
            }),
            subscriptions: NO_SUBS,
        });

        expect(sdk.success).toBe(true);
        expect(sdk.isAvailable).toEqual({ value: true, message: 'Entitled' });
    });

    test('mode:off → allowed without consulting the subscription list', async () => {
        const { sdk, fetchMock } = await initSdk(RBAC_CONFIG, {
            verify: VERIFIED,
            orgStatus: withEntitlement({ mode: 'off', products: { cardio: { entitled: false } } }),
            subscriptions: NO_SUBS,
        });

        expect(sdk.success).toBe(true);
        expect(sdk.isAvailable.value).toBe(true);
        expect(calledUrls(fetchMock)).toEqual([VERIFY_URL, ORG_STATUS_URL]);
    });

    test('no entitlement block → legacy path runs (subscription list fetched)', async () => {
        const { sdk, fetchMock } = await initSdk(RBAC_CONFIG, {
            verify: VERIFIED,
            orgStatus: FREE_STATUS,
            subscriptions: NO_SUBS,
        });

        expect(sdk.success).toBe(true);
        expect(sdk.isAvailable).toEqual({ value: true, message: 'Free account' });
        expect(calledUrls(fetchMock)).toEqual([VERIFY_URL, ORG_STATUS_URL, SUBSCRIPTIONS_URL]);
    });

    test("explicit 'legacy' source ignores an enforced entitlement block (the pre-2.0 default)", async () => {
        const { sdk } = await initSdk({ ...API_KEY_CONFIG, entitlementSource: 'legacy' }, {
            verify: VERIFIED,
            orgStatus: {
                status: 200,
                body: {
                    data: {
                        accountType: 'free',
                        entitlement: { mode: 'enforce', products: { cardio: { entitled: false } } },
                    },
                },
            },
            subscriptions: NO_SUBS,
        });

        expect(sdk.isAvailable).toEqual({ value: true, message: 'Free account' });
    });
});

describe('startCardioTest() — failures settle the promise', () => {
    test('rejects with AIZERR008 when orgStatus answers 401 after a successful init (accesstoken)', async () => {
        let orgStatus = FREE_STATUS;
        const { sdk } = await initSdk(ACCESS_TOKEN_CONFIG, {
            verify: VERIFIED,
            orgStatus: () => orgStatus,
            subscriptions: NO_SUBS,
        });
        expect(sdk.success).toBe(true);

        orgStatus = { status: 401, body: { message: 'Token expired' } };
        await expect(sdk.startCardioTest()).rejects.toMatchObject({ code: 'AIZERR008', message: 'Token expired' });
    });

    test('rejects with AIZERR009 when the subscription list answers 403 (apikey)', async () => {
        let subscriptions = {
            status: 200,
            body: { subscriptions: [{ productType: 'cardio', stripe: { status: 'active' } }] },
        };
        const { sdk } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: {
                status: 200,
                body: {
                    data: {
                        accountType: 'active',
                        totalCardioTestCount: 0,
                        testLimitByCurrentSubscription: { cardio: { testLimit: { interval_count: 1, unit: 50 } } },
                    },
                },
            },
            subscriptions: () => subscriptions,
        });
        expect(sdk.success).toBe(true);

        subscriptions = { status: 403, body: NOT_JSON };
        await expect(sdk.startCardioTest()).rejects.toMatchObject({
            code: 'AIZERR009',
            message: 'Failed to fetch subscription list.',
        });
    });

    test('rejects with AIZERR004 when orgStatus fails at the network level', async () => {
        let orgStatus = FREE_STATUS;
        const { sdk } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: () => orgStatus,
            subscriptions: NO_SUBS,
        });

        orgStatus = new TypeError('Failed to fetch');
        await expect(sdk.startCardioTest()).rejects.toMatchObject({
            code: 'AIZERR004',
            message: 'Failed to fetch organization status.',
        });
    });

    test('rejects with the availability code when the account is no longer allowed', async () => {
        let orgStatus = FREE_STATUS;
        const { sdk } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: () => orgStatus,
            subscriptions: NO_SUBS,
        });

        orgStatus = { status: 200, body: { data: { accountType: 'trial_expired' } } };
        await expect(sdk.startCardioTest()).rejects.toMatchObject({ code: 'AIZERR001', message: 'Trial expired' });
    });

    test('the module-level startCardioTest export rejects the same way', async () => {
        let orgStatus = FREE_STATUS;
        const { mod } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: () => orgStatus,
            subscriptions: NO_SUBS,
        });

        orgStatus = { status: 500, body: {} };
        await expect(mod.startCardioTest()).rejects.toMatchObject({ code: 'AIZERR004' });
    });

    test('rejects (does not hang) when the container never appears', async () => {
        jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
        try {
            const { sdk } = await initSdk({ ...API_KEY_CONFIG, containerId: 'missing-container' }, {
                verify: VERIFIED,
                orgStatus: FREE_STATUS,
                subscriptions: NO_SUBS,
            });

            const pending = sdk.startCardioTest();
            await flush();
            jest.advanceTimersByTime(3000); // three 1s retries
            await expect(pending).rejects.toThrow('Container element with ID "missing-container" not found.');
        } finally {
            jest.clearAllTimers();
            jest.useRealTimers();
        }
    });
});

describe('iframe messages', () => {
    const ROUTES = { verify: VERIFIED, orgStatus: FREE_STATUS, subscriptions: NO_SUBS };
    let container;
    let uncaught;

    beforeEach(() => {
        // Timers are faked so the SDK's postMessage retry interval never runs on its own;
        // microtask-based waiting (flush) still works because it uses the real setImmediate.
        jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
        container = document.createElement('div');
        container.id = 'iselfietest';
        document.body.appendChild(container);
        uncaught = jest.fn();
        window.addEventListener('error', uncaught);
    });

    afterEach(() => {
        window.removeEventListener('error', uncaught);
        jest.clearAllTimers();
        jest.useRealTimers();
        container.remove();
    });

    async function startPendingTest(config = API_KEY_CONFIG) {
        const started = await initSdk(config, ROUTES);
        expect(started.sdk.success).toBe(true);
        const pending = started.sdk.startCardioTest();
        await flush();
        expect(document.getElementById('iselfietest-iframe')).not.toBeNull();
        return { ...started, pending };
    }

    test('mounts the iframe in the container with the expected src', async () => {
        const { pending } = await startPendingTest();
        const iframe = document.getElementById('iselfietest-iframe');
        expect(iframe.parentElement).toBe(container);
        expect(iframe.src).toBe('https://app.test/sdk/before-cardio-test?isSDK=true');
        expect(iframe.allow).toBe('camera; microphone');

        postFromIframe({ type: 'iselfietest-close' });
        await expect(pending).rejects.toMatchObject({ code: 'AIZERR011' });
    });

    test('iselfietest-error rejects the pending test with the reported code and closes the iframe', async () => {
        const { pending } = await startPendingTest();

        postFromIframe({ type: 'iselfietest-error', data: { code: 'AIZERR010', message: 'Product not entitled' } });

        const error = await pending.catch((e) => e);
        expect(error).toBeInstanceOf(Error);
        expect(error.code).toBe('AIZERR010');
        expect(error.message).toBe('Product not entitled');
        expect(document.getElementById('iselfietest-iframe')).toBeNull();
    });

    test('iselfietest-error without a payload rejects with a generic Error', async () => {
        const { pending } = await startPendingTest();

        postFromIframe({ type: 'iselfietest-error' });

        const error = await pending.catch((e) => e);
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Test failed');
        expect(error.code).toBeUndefined();
    });

    test('iselfietest-close rejects a pending test with AIZERR011', async () => {
        const { pending } = await startPendingTest();

        postFromIframe({ type: 'iselfietest-close' });

        await expect(pending).rejects.toMatchObject({ code: 'AIZERR011', message: 'Test cancelled' });
        expect(document.getElementById('iselfietest-iframe')).toBeNull();
    });

    test('iselfietest-complete resolves with the result; iselfietest-credential rotates the key for later calls', async () => {
        const { sdk, fetchMock, pending } = await startPendingTest(ACCESS_TOKEN_CONFIG);

        postFromIframe({ type: 'iselfietest-credential', data: { apiKey: '' } }); // ignored: empty
        postFromIframe({ type: 'iselfietest-credential', data: { apiKey: 42 } }); // ignored: not a string
        postFromIframe({ type: 'iselfietest-credential' }); // ignored: no data
        postFromIframe({ type: 'iselfietest-credential', data: { apiKey: 'new' } });

        const result = { hr: { value: 72 }, spo2: 98 };
        postFromIframe({ type: 'iselfietest-complete', data: result });
        await expect(pending).resolves.toBe(result);
        expect(document.getElementById('iselfietest-iframe')).toBeNull();

        fetchMock.mockClear();
        const second = sdk.startCardioTest();
        await flush();

        const statusCall = fetchMock.mock.calls.find(([url]) => url === ORG_STATUS_URL);
        const subsCall = fetchMock.mock.calls.find(([url]) => url === SUBSCRIPTIONS_URL);
        expect(statusCall[1].headers['X-Api-Key']).toBe('new');
        expect(subsCall[1].headers['X-Api-Key']).toBe('new');
        expect(document.getElementById('iselfietest-iframe')).not.toBeNull();

        postFromIframe({ type: 'iselfietest-close' });
        await expect(second).rejects.toMatchObject({ code: 'AIZERR011' });
    });

    test('settles a pending test only once', async () => {
        const { pending } = await startPendingTest();

        postFromIframe({ type: 'iselfietest-error', data: { code: 'AIZERR002' } });
        postFromIframe({ type: 'iselfietest-complete', data: { hr: 60 } });
        postFromIframe({ type: 'iselfietest-close' });

        await expect(pending).rejects.toMatchObject({ code: 'AIZERR002' });
        expect(uncaught).not.toHaveBeenCalled();
    });

    test('tolerates messages without data and unrelated messages', async () => {
        const { pending } = await startPendingTest();

        window.dispatchEvent(new MessageEvent('message', { data: null }));
        window.dispatchEvent(new MessageEvent('message', { data: 'ping' }));
        window.dispatchEvent(new MessageEvent('message', { data: { type: 'something-else' } }));
        postFromIframe({ type: 'iselfietest-close', data: null });

        expect(uncaught).not.toHaveBeenCalled();
        await expect(pending).rejects.toMatchObject({ code: 'AIZERR011' });

        // A close with nothing pending is a no-op (no second rejection, no exception).
        postFromIframe({ type: 'iselfietest-close' });
        expect(uncaught).not.toHaveBeenCalled();
    });
});

// --- 2.0.0 ---------------------------------------------------------------------------------------

const ENFORCE_BLOCK = (cardio) => ({ mode: 'enforce', products: { cardio } });
const statusWithBlock = (block, accountType = 'trial') => ({
    status: 200,
    body: { data: { accountType, totalCardioTestCount: 0, entitlement: block } },
});

// A JWT-shaped token whose payload carries `exp` (seconds). Signature is never checked client-side.
const tokenExpiringInMs = (ms) => {
    const payload = { organizationId: 'org1', exp: Math.floor((Date.now() + ms) / 1000) };
    const b64 = btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `eyJhbGciOiJIUzI1NiJ9.${b64}.sig`;
};

describe("2.0.0 — entitlementSource 'auto' follows an enforcing server", () => {
    test('default is auto: an enforcing block decides, and the subscription list is not fetched', async () => {
        const { sdk, fetchMock } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: statusWithBlock(ENFORCE_BLOCK({ entitled: false, reason: 'trial_expired' })),
            subscriptions: NO_SUBS,
        });
        expect(sdk.isAvailable.code).toBe('AIZERR001');
        expect(calledUrls(fetchMock)).toEqual([VERIFY_URL, ORG_STATUS_URL]);
    });

    test('auto: an enforcing block that allows lets a trial org test even when the legacy arithmetic would refuse', async () => {
        // Legacy would say AIZERR002 here (cardioTrialTestLimit 0 - 0 tests = 0 remaining); the server says entitled.
        const { sdk } = await initSdk(API_KEY_CONFIG, {
            verify: { status: 200, body: { success: true, organization: { ...ORG, accountType: 'trial', cardioTrialTestLimit: 0, trialEnd: new Date(Date.now() + 86400000).toISOString() } } },
            orgStatus: statusWithBlock(ENFORCE_BLOCK({ entitled: true, unlimited: false, remaining: 5 })),
            subscriptions: NO_SUBS,
        });
        expect(sdk.success).toBe(true);
        expect(sdk.isAvailable.value).toBe(true);
    });

    test('auto: a block at off/shadow is ignored and the legacy check decides (subscriptions fetched)', async () => {
        const { sdk, fetchMock } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: statusWithBlock({ mode: 'shadow', products: { cardio: { entitled: false } } }, 'free'),
            subscriptions: NO_SUBS,
        });
        expect(sdk.isAvailable).toEqual({ value: true, message: 'Free account' });
        expect(calledUrls(fetchMock)).toEqual([VERIFY_URL, ORG_STATUS_URL, SUBSCRIPTIONS_URL]);
    });

    test('auto against a server that sends no block runs the legacy check, exactly as 0.1.x did', async () => {
        const { sdk, fetchMock } = await initSdk(API_KEY_CONFIG, {
            verify: VERIFIED,
            orgStatus: FREE_STATUS,
            subscriptions: NO_SUBS,
        });
        expect(sdk.isAvailable).toEqual({ value: true, message: 'Free account' });
        expect(calledUrls(fetchMock)).toEqual([VERIFY_URL, ORG_STATUS_URL, SUBSCRIPTIONS_URL]);
    });

    test("explicit 'legacy' never looks at the block", async () => {
        const { sdk } = await initSdk({ ...API_KEY_CONFIG, entitlementSource: 'legacy' }, {
            verify: VERIFIED,
            orgStatus: statusWithBlock(ENFORCE_BLOCK({ entitled: false, reason: 'plan' }), 'free'),
            subscriptions: NO_SUBS,
        });
        expect(sdk.isAvailable).toEqual({ value: true, message: 'Free account' });
    });

    test("explicit 'rbac' honours a block even at shadow (allows, without the legacy check)", async () => {
        const { sdk, fetchMock } = await initSdk({ ...API_KEY_CONFIG, entitlementSource: 'rbac' }, {
            verify: VERIFIED,
            orgStatus: statusWithBlock({ mode: 'shadow', products: { cardio: { entitled: false } } }, 'trial_expired'),
            subscriptions: NO_SUBS,
        });
        expect(sdk.isAvailable.value).toBe(true);
        expect(calledUrls(fetchMock)).toEqual([VERIFY_URL, ORG_STATUS_URL]);
    });

    test('an unknown entitlementSource value falls back to auto', async () => {
        const { sdk, fetchMock } = await initSdk({ ...API_KEY_CONFIG, entitlementSource: 'bogus' }, {
            verify: VERIFIED,
            orgStatus: statusWithBlock(ENFORCE_BLOCK({ entitled: false })),
            subscriptions: NO_SUBS,
        });
        expect(sdk.isAvailable.code).toBe('AIZERR010');
        expect(calledUrls(fetchMock)).toEqual([VERIFY_URL, ORG_STATUS_URL]);
    });
});

describe('2.0.0 — the credential is renewed before a test starts', () => {
    const containerReady = () => {
        const div = document.createElement('div');
        div.id = 'iselfietest';
        document.body.appendChild(div);
        return div;
    };

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('a token with less than two minutes left is renewed, and the new token is what the test uses', async () => {
        const stale = tokenExpiringInMs(60 * 1000);
        const fresh = tokenExpiringInMs(5 * 60 * 1000);
        const { sdk, fetchMock } = await initSdk({ ...ACCESS_TOKEN_CONFIG, apiKey: stale }, {
            verify: VERIFIED,
            orgStatus: FREE_STATUS,
            subscriptions: NO_SUBS,
            refresh: { status: 200, body: { success: true, access_token: fresh, kind: 'partner' } },
        });
        expect(sdk.success).toBe(true);
        containerReady();
        sdk.startCardioTest().catch(() => {});
        await flush();
        await flush();

        const urls = calledUrls(fetchMock);
        const refreshIdx = urls.indexOf(REFRESH_URL);
        expect(refreshIdx).toBeGreaterThan(-1);
        // Renewed BEFORE the status check that startCardioTest() runs.
        expect(urls.lastIndexOf(ORG_STATUS_URL)).toBeGreaterThan(refreshIdx);
        const [, refreshInit] = fetchMock.mock.calls[refreshIdx];
        expect(refreshInit.headers['X-Api-Key']).toBe(stale);
        const [, statusInit] = fetchMock.mock.calls[urls.lastIndexOf(ORG_STATUS_URL)];
        expect(statusInit.headers['X-Api-Key']).toBe(fresh);
    });

    test('a token with plenty of life left is not renewed', async () => {
        const live = tokenExpiringInMs(30 * 60 * 1000);
        const { sdk, fetchMock } = await initSdk({ ...ACCESS_TOKEN_CONFIG, apiKey: live }, {
            verify: VERIFIED, orgStatus: FREE_STATUS, subscriptions: NO_SUBS,
        });
        containerReady();
        sdk.startCardioTest().catch(() => {});
        await flush();
        expect(calledUrls(fetchMock)).not.toContain(REFRESH_URL);
    });

    test('a raw API key is never renewed', async () => {
        const { sdk, fetchMock } = await initSdk(API_KEY_CONFIG, { verify: VERIFIED, orgStatus: FREE_STATUS, subscriptions: NO_SUBS });
        containerReady();
        sdk.startCardioTest().catch(() => {});
        await flush();
        expect(calledUrls(fetchMock)).not.toContain(REFRESH_URL);
    });

    test('a server without the refresh route (404) keeps the current token and the test proceeds', async () => {
        const stale = tokenExpiringInMs(60 * 1000);
        const { sdk, fetchMock } = await initSdk({ ...ACCESS_TOKEN_CONFIG, apiKey: stale }, {
            verify: VERIFIED, orgStatus: FREE_STATUS, subscriptions: NO_SUBS,
            refresh: { status: 404, body: NOT_JSON },
        });
        containerReady();
        const p = sdk.startCardioTest();
        p.catch(() => {});
        await flush();
        await flush();
        const urls = calledUrls(fetchMock);
        expect(urls).toContain(REFRESH_URL);
        const [, statusInit] = fetchMock.mock.calls[urls.lastIndexOf(ORG_STATUS_URL)];
        expect(statusInit.headers['X-Api-Key']).toBe(stale);
        expect(document.getElementById('iselfietest-iframe')).not.toBeNull(); // the test still started
    });

    test('a network failure on refresh is swallowed', async () => {
        const stale = tokenExpiringInMs(60 * 1000);
        const { sdk, fetchMock } = await initSdk({ ...ACCESS_TOKEN_CONFIG, apiKey: stale }, {
            verify: VERIFIED, orgStatus: FREE_STATUS, subscriptions: NO_SUBS,
            refresh: new TypeError('Failed to fetch'),
        });
        containerReady();
        sdk.startCardioTest().catch(() => {});
        await flush();
        await flush();
        expect(calledUrls(fetchMock)).toContain(REFRESH_URL);
        expect(document.getElementById('iselfietest-iframe')).not.toBeNull();
    });
});
