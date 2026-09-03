import { dev, prod } from "./config";
import _ from 'lodash';
import { isAfter } from 'date-fns';

// Error code enum map
export const ERROR_CODES = {
    AIZERR001: {
        code: 'AIZERR001',
        note: 'Trial expired'
    },
    AIZERR002: {
        code: 'AIZERR002',
        note: 'Trial usage limit exceeded'
    },
    AIZERR003: {
        code: 'AIZERR003',
        note: 'Active subscription usage limit succeeded'
    },
    AIZERR004: {
        code: 'AIZERR004',
        note: 'No active subscription'
    },
    // Keyed AIZERR005 to match the code it emits. It was keyed AIZERR006 while emitting
    // 'AIZERR005', so `ERROR_CODES.AIZERR006.code` read back a different string than its own name —
    // the KEY was the typo, not the code. Renaming the key keeps the wire value integrators already
    // match on unchanged; changing the code would have broken them.
    AIZERR005: {
        code: 'AIZERR005',
        note: 'Domain not allowed or Invalid API key'
    },
    AIZERR007: {
        code: 'AIZERR007',
        note: 'Invalid organization ID'
    },
    AIZERR008: {
        code: 'AIZERR008',
        note: 'Invalid access token'
    },
    AIZERR009: {
        code: 'AIZERR009',
        note: 'Invalid API key'
    },
    AIZERR010: {
        code: 'AIZERR010',
        note: 'Product not entitled'
    },
    AIZERR011: {
        code: 'AIZERR011',
        note: 'Test cancelled'
    }
};

// Backward-compatible alias. Releases up to 0.1.14 exported the 'AIZERR005' entry under the key
// AIZERR006, so integrators may reference `ERROR_CODES.AIZERR006.code`. Aliasing (not copying) the
// same object keeps that expression working and still reading 'AIZERR005', the wire value.
ERROR_CODES.AIZERR006 = ERROR_CODES.AIZERR005;

// Parse a fetch Response body as JSON. Returns {} when the body is empty or not JSON (an HTML
// error page from a proxy, a 204, a truncated response) so callers can read fields off the
// result with plain property access instead of crashing on the parse.
async function readJson(response) {
    try {
        const body = await response.json();
        return body && typeof body === 'object' ? body : {};
    } catch (error) {
        return {};
    }
}

// Class representing the iSelfieTest instance
class ISelfieTestInstance {
    constructor(_config) {
        // Initialize class properties
        this.iframe = null;
        this.resolveTest = null;
        this.rejectTest = null;
        this.domain = window.location.origin; // Get the current domain
        this.organization = null;
        this.success = false;
        this.isAvailable = { value : false, message : 'Not initialized' }; // Add isAvailable property

        // Basic configuration
        this.config = _config?.environment === "dev" ? dev : prod; // environment
        this.apiKey = _config?.apiKey || ''; // API key for validation
        this.appUserId = _config?.appUserId || ''; // App user ID
        this.organizationId = _config?.organizationId || ''; // Organization ID
        this.containerId = _config?.containerId || 'iselfietest'; // ID of the container for the iframe
        this.verificationMethod = _config?.verificationMethod || 'apikey'; // Verification method: 'apikey' or 'accesstoken' (case insensitive)
        // Entitlement source — how the SDK decides whether a test may start:
        //   'auto'   (default since 2.0.0) follow the server when it sends an entitlement block in
        //            orgStatus AND says it is enforcing; otherwise run the legacy client-side check.
        //            Once a server enforces, its answer is what the results call will be judged by,
        //            so the client-side arithmetic can only disagree with it.
        //   'rbac'   gate on the server's block whenever it is present (also at off/shadow, where
        //            it allows); legacy check only when no block is sent.
        //   'legacy' never look at the block; the pre-2.0 behaviour.
        // Old servers send no block, so every mode keeps working against them.
        this.entitlementSource = String(_config?.entitlementSource || 'auto').toLowerCase();
        if (!['auto', 'rbac', 'legacy'].includes(this.entitlementSource)) this.entitlementSource = 'auto';

        // Options for customizing the test
        this.options = {
            displayResults: _config?.options?.displayResults ?? false, // Display results after the test is completed
            enablePDFSharing: _config?.options?.enablePDFSharing ?? false, // Allow users to share their test results as a PDF document
            timezone: _config?.options?.timezone ?? 'Etc/UTC', // Time zone used for displaying timestamps in the test results
            disableAudio: _config?.options?.disableAudio ?? false, // Disable audio during the test
            language: _config?.options?.language ?? 'en', // Language used for the test interface and instructions
            isDarkMode: _config?.options?.isDarkMode ?? true, // Enable dark mode for the test UI by default
            disableMotionDetection: _config?.options?.disableMotionDetection ?? false, // Disable motion detection during the test (if false, motion detection is enabled)
            disableLightCheck: _config?.options?.disableLightCheck ?? false, // Disable light level check during the test (if false, light level will be checked)
            disableDistanceCheck: _config?.options?.disableDistanceCheck ?? false, // Disable distance check during the test (if false, user's distance from the camera will be checked)
            terminateTestIfConditionPersisted: _config?.options?.terminateTestIfConditionPersisted ?? false, // Terminate the test if certain failure conditions persist during the test
            testTerminationTimeOut: _config?.options?.testTerminationTimeOut ?? 7, // Timeout in seconds before terminating the test if a persistent condition is detected
            instructionPage: _config?.options?.instructionPage ?? {
                hidden: false, // Display an instruction page before the test starts
                instructionContent: null, // Custom instruction page content
            },
            progressBarPosition: _config?.options?.progressBarPosition ?? 'bottom', // Position of the progress bar
            showLanguageSelector: _config?.options?.showLanguageSelector ?? true, // Show language selector
            enableMobileCameraSwap: _config?.options?.enableMobileCameraSwap ?? false, // Allow users to swap between front/rear cameras on mobile devices during the test
        };

        // Styling options
        this.styles = {
            pageBackgroundColor: _config?.styles?.pageBackgroundColor || '', // Page background color
            cardBackgroundColor: _config?.styles?.cardBackgroundColor || '', // Card background color
            cardHeaderBackgroundColor: _config?.styles?.cardHeaderBackgroundColor || '', // Card header color
            primaryTextColor: _config?.styles?.primaryTextColor || '', // Primary text color
            secondaryTextColor: _config?.styles?.secondaryTextColor || '', // Secondary text color
            buttonColor: _config?.styles?.buttonColor || '', // Button background color
            buttonTextColor: _config?.styles?.buttonTextColor || '', // Button text color
            iconColor: _config?.styles?.iconColor || '', // Icon color
            fontFace: _config?.styles?.fontFace || '', // Font Face
        };
    }

    // Method to verify API key with the backend
    async verifyApiKey() {
        try {
            let response, result;
            
            if (this.verificationMethod?.toLowerCase() === 'accesstoken') {
                // Access token verification method
                response = await fetch(`${this.config.backend_url}/sdk/central/access-token/verify`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        access_token: this.apiKey,
                        organizationId: this.organizationId
                    })
                });
            } else {
                // Default API key verification method (backward compatibility)
                response = await fetch(`${this.config.backend_url}/sdk/central/verify`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Api-Key': this.apiKey, // Pass the API key in the request headers
                    },
                });
            }
            
            result = await readJson(response);
            if (!response.ok) {
                // A non-2xx status (401/403/5xx, or a proxy error page) is a failed verification
                // even when the body carries no `success` flag; the code mapping below applies.
                result.success = false;
            }
            this.success = result.success;
            this.organization = result.organization || null;
            
            // Handle specific error cases for different verification methods
            if (!result.success) {
                if (this.verificationMethod?.toLowerCase() === 'accesstoken') {
                    // Any failure from access token endpoint is AIZERR008
                    result.errorCode = ERROR_CODES.AIZERR008.code;
                    result.errorMessage = ERROR_CODES.AIZERR008.note;
                } else {
                    // Any failure from API key endpoint is AIZERR009
                    result.errorCode = ERROR_CODES.AIZERR009.code;
                    result.errorMessage = ERROR_CODES.AIZERR009.note;
                }
            }
            
            return result;
        } catch (error) {
            console.error('API call failed:', error.message ?? error);
            this.success = false;
            return { 
                success: false, 
                message: error.message ?? 'Network error occurred',
                errorCode: this.verificationMethod?.toLowerCase() === 'accesstoken' ? ERROR_CODES.AIZERR008.code : ERROR_CODES.AIZERR009.code,
                errorMessage: this.verificationMethod?.toLowerCase() === 'accesstoken' ? ERROR_CODES.AIZERR008.note : ERROR_CODES.AIZERR009.note
            };
        }
    }

    // Build the Error thrown for a non-2xx API response. 401/403 mean the credential was rejected,
    // so they map to the same code verifyApiKey() reports for this verification method; 404 means
    // the organization the credential named does not exist (AIZERR007); any other status (429,
    // 5xx, a proxy page) is reported as AIZERR004 so the caller still receives a code.
    httpError(response, body, fallbackMessage) {
        const error = new Error(body?.message || fallbackMessage);
        if (response.status === 401 || response.status === 403) {
            error.code = this.verificationMethod?.toLowerCase() === 'accesstoken'
                ? ERROR_CODES.AIZERR008.code
                : ERROR_CODES.AIZERR009.code;
        } else if (response.status === 404) {
            error.code = ERROR_CODES.AIZERR007.code;
        } else {
            error.code = ERROR_CODES.AIZERR004.code;
        }
        return error;
    }

    // Fetch organization status
    async fetchOrgStatus() {
        let response;
        try {
            response = await fetch(`${this.config.backend_url}/sdk/central/orgStatus`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': this.apiKey,
                },
                body: JSON.stringify({
                    organizationId: this.organization._id, // Include the orgId in the request body
                }),
            });
        } catch (error) {
            throw new Error('Failed to fetch organization status.');
        }
        const result = await readJson(response);
        if (!response.ok) {
            throw this.httpError(response, result, 'Failed to fetch organization status.');
        }
        return result.data; // Return orgStatus result
    }

    // Fetch subscription list
    async fetchSubscriptionList() {
        if (!this.organization?._id) {
            throw new Error('Organization ID not available.');
        }
        let response;
        try {
            response = await fetch(`${this.config.backend_url}/subscription/central/sdk/${this.organization._id}/list`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': this.apiKey,
                },
            });
        } catch (error) {
            throw new Error('Failed to fetch subscription list.');
        }
        const result = await readJson(response);
        if (!response.ok) {
            throw this.httpError(response, result, 'Failed to fetch subscription list.');
        }
        // A missing or null `subscriptions` value must read as "no subscriptions", not crash the
        // caller's .filter().
        return Array.isArray(result.subscriptions) ? result.subscriptions : [];
    }

    // Is this denial an expired trial rather than a missing product?
    //
    // Three signals, in descending order of directness, because a given backend may only offer some:
    //   reason 'trial_expired' — the server said so outright (newest servers).
    //   expired:true           — the meter's trial window has passed but the org's accountType has
    //                            not flipped yet, so the resolver still sees a live trial.
    //   accountType            — from verifyApiKey's organization. This is the fallback that keeps
    //                            the SDK correct against a backend predating either field, and it is
    //                            also the ONLY reliable signal once an operator override is set: the
    //                            server's expiry check requires source==='trial', so an override
    //                            silently suppresses `expired`.
    isTrialExpired(product) {
        return (
            product?.reason === 'trial_expired' ||
            !!product?.expired ||
            String(this.organization?.accountType || '').toLowerCase() === 'trial_expired'
        );
    }

    // Gate on the server's enforced entitlement block (orgStatus.entitlement). The server computes
    // it from the same meter the API enforces with, so this refuses BEFORE the camera opens instead
    // of scanning and being 402'd at the results call. Only blocks when the server says
    // mode:'enforce' — at off/shadow the backend would serve the test, so we must not refuse it.
    checkRbacEntitlement(entitlement) {
        if (entitlement?.mode !== 'enforce') {
            return { value: true, message: `Entitlement mode ${entitlement?.mode || 'unknown'} — server not enforcing` };
        }
        const cardio = entitlement?.products?.cardio;
        if (!cardio) return { value: true, message: 'No cardio entitlement data — deferring to server' };
        if (cardio.entitled === false) {
            // An expired trial and a product that was never sold are BOTH entitled:false, so this
            // branch has to separate them or every denial reads as "you don't own this". The legacy
            // check below distinguishes them (accountType 'trial_expired' -> AIZERR001), and
            // integrators handle that code today, so losing it here would be a silent regression.
            const err = this.isTrialExpired(cardio) ? ERROR_CODES.AIZERR001 : ERROR_CODES.AIZERR010;
            console.error(err.note);
            return { value: false, message: err.note, code: err.code };
        }
        if (cardio.expired) {
            console.error(ERROR_CODES.AIZERR001.note);
            return { value: false, message: 'Trial expired', code: ERROR_CODES.AIZERR001.code };
        }
        if (!cardio.unlimited && cardio.remaining !== null && cardio.remaining <= 0) {
            console.error(ERROR_CODES.AIZERR002.note);
            return { value: false, message: 'Usage limit exceeded', code: ERROR_CODES.AIZERR002.code };
        }
        return { value: true, message: 'Entitled' };
    }

    // Check organization status
    async checkOrgStatus() {
        try {
            // Fetch additional data
            const orgStatus = await this.fetchOrgStatus();

            // Server-driven path. 'rbac': the block is authoritative whenever present. 'auto': only
            // when the server says it is ENFORCING — at off/shadow the server would serve the test
            // whatever the block says, so the legacy check keeps deciding, exactly as before 2.0.
            // A legacy server sends no block, so the legacy checks below keep working unchanged.
            const block = orgStatus?.entitlement;
            if (block && (this.entitlementSource === 'rbac' ||
                (this.entitlementSource === 'auto' && block.mode === 'enforce'))) {
                return this.checkRbacEntitlement(block);
            }

            const subscriptionList = await this.fetchSubscriptionList();

            const accountType = orgStatus?.accountType;
            const totalCardioTestCount = orgStatus?.totalCardioTestCount || 0;

            const activeSubscriptions = subscriptionList.filter(
                (sub) => sub?.productType === "cardio" && sub?.stripe?.status === "active"
            );

            if (accountType === 'free') {
                return { value: true, message: 'Free account' };
            }

            if (accountType === 'trial_expired') {
                console.error(ERROR_CODES.AIZERR001.note);
                return { value: false, message: 'Trial expired', code: ERROR_CODES.AIZERR001.code };
            }

            if (accountType === 'trial') {
                // Check if trial has expired
                const trialEnd = new Date(this.organization?.trialEnd);
                const now = new Date();

                // Check if trialEnd is valid and compare dates
                if (isAfter(now, trialEnd)) {
                    console.error(ERROR_CODES.AIZERR001.note);
                    return { value: false, message: 'Trial expired', code: ERROR_CODES.AIZERR001.code };
                }

                // Check if trial usage limit has been exceeded
                const cardioTrialTestLimit = this.organization?.cardioTrialTestLimit || 0;
                const remainingCardioTests = cardioTrialTestLimit - totalCardioTestCount;
                if (remainingCardioTests > 0) {
                    return { value: true, message: 'Active trial account' };
                } else {
                    console.error(ERROR_CODES.AIZERR002.note);
                    return { value: false, message: 'Trial usage limit exceeded', code: ERROR_CODES.AIZERR002.code };
                }
            }
            if (accountType === 'active') {
                const cardio = orgStatus?.testLimitByCurrentSubscription?.cardio;
                const cardioCount = cardio?.testLimit
                    ? cardio.testLimit.interval_count * cardio.testLimit.unit
                    : 0;
                const remainingCardioTests = cardioCount - totalCardioTestCount;

                const activeSubscriptions = subscriptionList.filter(
                    (sub) => sub?.productType === "cardio" && sub?.stripe?.status === "active"
                );

                if (remainingCardioTests > 0 && activeSubscriptions.length > 0) {
                    return { value: true, message: 'Active subscription' };
                } else {
                    console.error(ERROR_CODES.AIZERR003.note);
                    return { value: false, message: 'Active subscription usage limit exceeded', code: ERROR_CODES.AIZERR003.code };
                }
            }

            if (accountType === 'active' && activeSubscriptions.length === 0) {
                console.error(ERROR_CODES.AIZERR004.note);
                return { value: false, message: 'No active subscription', code: ERROR_CODES.AIZERR004.code };
            }

            return { value: false, message: 'No active subscription', code: ERROR_CODES.AIZERR004.code };
        } catch (error) {
            // A failed status/subscription request (auth rejected, 5xx, network) becomes a coded
            // refusal instead of an exception, so initialize() and startTest() always settle.
            console.error('Organization status check failed:', error?.message ?? error);
            return {
                value: false,
                message: error?.message || 'Failed to check organization status.',
                code: error?.code || ERROR_CODES.AIZERR004.code
            };
        }
    }

    // Expiry of the credential when it is an SDK access token (a JWT with `exp`), else null for
    // a raw API key. The signature is not checked here — the server does that.
    credentialExpiresAtMs() {
        if (typeof this.apiKey !== 'string') return null;
        const parts = this.apiKey.split('.');
        if (parts.length !== 3) return null;
        try {
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)));
            return typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
        } catch (error) {
            return null;
        }
    }

    // Renew an access token that is about to lapse, BEFORE a test starts, so the credential the
    // embedded page receives covers the whole test. Best effort, always: a server that predates
    // the refresh route (404), a network blip, or a chain past its renewal cap keeps the current
    // token and the test proceeds on it. A raw API key never expires and is left alone.
    async refreshCredentialIfNeeded(minRemainingMs = 2 * 60 * 1000) {
        const expMs = this.credentialExpiresAtMs();
        if (expMs === null || expMs - Date.now() > minRemainingMs) return false;
        try {
            const response = await fetch(`${this.config.backend_url}/sdk/central/access-token/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': this.apiKey,
                },
            });
            if (!response.ok) return false;
            const result = await readJson(response);
            if (typeof result.access_token === 'string' && result.access_token) {
                this.apiKey = result.access_token;
                return true;
            }
        } catch (error) {
            // fall through: keep the current credential
        }
        return false;
    }

    // Wrapper method to verify API key and call additional APIs
    async initialize() {
        const result = await this.verifyApiKey();
        if (!result.success) {
            // Handle specific error codes
            if (result.errorCode) {
                const availability = {
                    value: false,
                    message: result.errorMessage,
                    code: result.errorCode
                };
                this.isAvailable = availability;
                return this.isAvailable;
            } else if (result.message === 'Verification failed across all regions. Invalid public key or domain.') {
                const availability = {
                    value: false,
                    message: ERROR_CODES.AIZERR005.note,
                    code: ERROR_CODES.AIZERR005.code
                };
                this.isAvailable = availability;
                return this.isAvailable;
            } else {
                throw new Error(`Verification failed: ${result.message}`);
            }
        }

        this.isAvailable = await this.checkOrgStatus();

        return this.isAvailable;
    }

    // Method to create and display the iframe for the test
    createIframe(container) {
        if (this.iframe) {
            // If iframe already exists, send a message to it
            this.sendMessageToIframe();
            return;
        }

        // Create the iframe element
        this.iframe = document.createElement('iframe');
        this.iframe.id = 'iselfietest-iframe'; // Set iframe ID
        this.iframe.style.border = 'none'; // Remove border
        this.iframe.style.width = '100%'; // Set full width
        this.iframe.style.height = '100%'; // Set full height
        this.iframe.allow = 'camera; microphone'; // Allow camera and microphone access

        // Set the iframe source URL
        console.log("this.config.frontend_url::", this.config.frontend_url);
        this.iframe.src = `${this.config.frontend_url}/sdk/before-cardio-test?isSDK=true`;
        container.appendChild(this.iframe); // Append iframe to the container

        this.iframe.onload = () => {
            console.log("Iframe loaded, sending initial message to parent");
            console.log("this.config.frontend_url::", this.config.frontend_url);
            this.sendMessageToIframe(); // Send initial message when iframe is loaded
        };

        // Listen for messages from the iframe
        window.addEventListener('message', (event) => this.handleIncomingMessages(event), false);
    }

    // Method to send initialization message to the iframe
    sendMessageToIframe() {
        const message = {
            type: 'iselfietest-sdk-init', // Message type
            data: {
                apiKey: this.apiKey,
                organization: {
                    id: this.organization?._id,
                    name: this.organization?.name,
                    description: this.organization?.description,
                    logo: this.organization?.imageUrl
                },
                privilege: this.organization?.privilege,
                appUserId: this.appUserId,
                domain: this.domain,
                options: this.options,
                styles: {
                    "--background-pages": this.styles.pageBackgroundColor,
                    "--background-card": this.styles.cardBackgroundColor,
                    "--background-card-title": this.styles.cardHeaderBackgroundColor,
                    "--text-primary": this.styles.primaryTextColor,
                    "--text-secondary": this.styles.secondaryTextColor,
                    "--button-primary-background": this.styles.buttonColor,
                    "--border-focused": this.styles.buttonColor,
                    "--button-primary-text": this.styles.buttonTextColor,
                    "--icon-default-background": this.styles.iconColor,
                    "--icon-primary-background": this.styles.iconColor,
                    "--font-face": this.styles.fontFace
                }
            }
        };

        // Retry sending the message until acknowledged
        const retryInterval = setInterval(() => {
            this.iframe.contentWindow.postMessage(message, this.config.frontend_url);

            // Check for acknowledgment from the iframe
            const acknowledgeMessage = (event) => {
                if (event.data.type === 'iselfietest-sdk-ack') {
                    clearInterval(retryInterval);
                    window.removeEventListener('message', acknowledgeMessage);
                }
            };

            window.addEventListener('message', acknowledgeMessage);
        }, 1000);
    }

    // Settle the pending startTest() promise, if any, and drop the handlers so a later message
    // (a second 'message' listener, a stray close) cannot touch an already-settled test.
    settleTest(kind, payload) {
        const settle = kind === 'reject' ? this.rejectTest : this.resolveTest;
        this.resolveTest = null;
        this.rejectTest = null;
        settle?.(payload);
    }

    // Method to handle incoming messages from the iframe
    handleIncomingMessages(event) {
        const { type, data } = event.data || {};

        if (type === 'iselfietest-close') {
            // A closed test can never complete, so a still-pending promise must be rejected
            // rather than left pending forever.
            if (this.resolveTest) {
                const error = new Error(ERROR_CODES.AIZERR011.note);
                error.code = ERROR_CODES.AIZERR011.code;
                this.settleTest('reject', error);
            }
            this.closeTest(); // Close the test on 'close' message
        }

        if (type === 'iselfietest-complete') {
            this.settleTest('resolve', data); // Resolve the test promise with data
            this.closeTest(); // Close the iframe
        }

        if (type === 'iselfietest-error') {
            const error = new Error(data?.message || 'Test failed');
            if (data?.code) error.code = data.code; // Carry the embedded page's code up to .catch()
            this.settleTest('reject', error); // Reject the test promise with the error
            this.closeTest(); // Close the iframe
        }

        if (type === 'iselfietest-credential') {
            // The embedded page renews the short-lived access token and hands the new one up;
            // adopting it keeps later startTest() calls (and their API requests) working.
            if (typeof data?.apiKey === 'string' && data.apiKey) {
                this.apiKey = data.apiKey;
            }
        }
    }

    // Method to start the test
    startTest() {
        return new Promise(async (resolve, reject) => {
            // An async executor swallows its own throws, which would leave the promise pending
            // forever; route anything unexpected to reject() instead.
            try {
                this.resolveTest = resolve; // Set resolve handler
                this.rejectTest = reject; // Set reject handler

                // A second test in the same session may start long after the token was minted.
                await this.refreshCredentialIfNeeded();

                const isAvailable = await this.checkOrgStatus();

                if(!isAvailable?.value) {
                    const errorMessage = isAvailable?.message || 'You have reached the maximum limit of cardio test usage policy. Please reach out to administrator.';
                    const error = new Error(errorMessage);
                    if (isAvailable?.code) {
                        error.code = isAvailable.code;
                    }
                    reject(error);
                    return;
                }

                // Try creating the iframe with retries
                const tryCreateIframe = (retryCount = 0) => {
                    const container = document.getElementById(this.containerId);

                    if (container) {
                        this.createIframe(container);
                    } else if (retryCount < 3) {
                        console.warn(
                            `Container element with ID "${this.containerId}" not found. Retrying... (${retryCount + 1}/3)`
                        );
                        setTimeout(() => tryCreateIframe(retryCount + 1), 1000); // Retry after 1 second
                    } else {
                        console.error(`Container element with ID "${this.containerId}" not found after 3 attempts.`);
                        reject(new Error(`Container element with ID "${this.containerId}" not found.`));
                    }
                };

                tryCreateIframe();
            } catch (error) {
                reject(error);
            }
        });
    }

    // Method to close the test and remove the iframe
    closeTest() {
        if (this.iframe) {
            const container = document.getElementById(this.containerId);
            container?.removeChild(this.iframe); // Remove the iframe from the DOM
            this.iframe = null; // Clear the iframe reference
            console.log("Iframe closed.");
        } else {
            console.log("No iframe to close.");
        }
    }

    // Add method to check availability
    getAvailability() {
        return this.isAvailable;
    }
}

// Global instance of the SDK
let instance;

// Function to initialize the SDK
export default async function ISelfieTest(options) {
    if (instance) {
        console.warn("SDK is already initialized. Returning the existing instance.");
        return {
            success: true,
            message: "SDK is already initialized.",
            startCardioTest: () => instance.startTest(),
            closeTest: () => instance.closeTest(),
            isAvailable: instance.getAvailability(),
        };
    }

    instance = new ISelfieTestInstance(options);

    try {
        // Verify API key and fetch additional data
        const isAvailable = await instance.initialize();

        if(isAvailable?.value) {
            return {
                success: true,
                message: "SDK initialized successfully.",
                startCardioTest: () => instance.startTest(),
                closeTest: () => instance.closeTest(),
                isAvailable: instance.getAvailability(),
            };
        } else {
            const availability = instance.getAvailability();
            return {
                success: false,
                message: availability?.message,
                isAvailable: availability,
            };
        }
    } catch (error) {
        console.error(error.message);
        return {
            success: false,
            message: error.message,
            isAvailable: false,
        };
    }
}

// Export test control functions
export const startCardioTest = () => instance?.startTest();
export const closeTest = () => instance?.closeTest();
export const getAvailability = () => instance?.getAvailability();

// Global UMD export for browser compatibility
if (typeof window !== 'undefined') {
    window.ISelfieCardioSDK = ISelfieTest;
    window.startCardioTest = startCardioTest;
    window.closeTest = closeTest;
    window.getAvailability = getAvailability;
}