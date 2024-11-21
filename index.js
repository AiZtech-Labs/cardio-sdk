import config from "./config";

class ISelfieTestInstance {
    constructor(_config) {
        this.iframe = null;
        this.testType = '';
        this.resolveTest = null;
        this.rejectTest = null;
        this.domain = window.location.origin;
        this.organization = null;
        this.success = false;

        // Basic
        this.apiKey = _config?.apiKey || '';
        this.appUserId = _config?.appUserId || '';
        this.containerId = _config?.containerId || 'iselfietest';

        //Options
        this.options = {
            displayResults: _config?.options?.displayResults || false,
            enablePDFSharing: _config?.options?.enablePDFSharing || false,
            timeZone: _config?.options?.timeZone || 'Etc/UTC',
            disableAudio: _config?.options?.disableAudio || false,
            language: _config?.options?.language || 'en',
            isDarkMode: _config?.options?.isDarkMode ||  true,
        }

        // Styles
        this.styles = {
            pageBackgroundColor: _config?.styles?.pageBackgroundColor || '',
            cardBackgroundColor: _config?.styles?.cardBackgroundColor || '',
            cardHeaderBackgroundColor: _config?.styles?.cardHeaderBackgroundColor || '',
            primaryTextColor: _config?.styles?.primaryTextColor || '',
            secondaryTextColor: _config?.styles?.secondaryTextColor || '',
            buttonColor: _config?.styles?.buttonColor || '',
            buttonTextColor: _config?.styles?.buttonTextColor || '',
            iconColor: _config?.styles?.iconColor || '',
        } 
    }

    async verifyApiKey() {
        try {
            const response = await fetch(`${config.backend_url}/sdk/verify`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': this.apiKey
                },
            });
            const result = await response.json();
            this.success = result.success;
            this.organization = result.organization || null;
            return this.success;
        } catch (error) {
            console.error('API call failed:', error);
            this.success = false;
            return false;
        }
    }

    createIframe(container) {
        if (this.iframe) {
            this.sendMessageToIframe();
            return;
        }

        this.iframe = document.createElement('iframe');
        this.iframe.id = 'iselfietest-iframe';
        this.iframe.style.border = 'none';
        this.iframe.style.width = '100%';
        this.iframe.style.height = '100%';
        this.iframe.allow = 'camera; microphone';

        this.iframe.src = `${config.frontend_url}/sdk/before-cardio-test?isSDK=true`;
        container.appendChild(this.iframe);

        this.iframe.onload = () => {
            console.log("Iframe loaded, sending initial message to parent");
            this.sendMessageToIframe();
        };

        window.addEventListener('message', (event) => this.handleIncomingMessages(event), false);
    }

    sendMessageToIframe() {
        const message = {
            type: 'iselfietest-sdk-init',
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
					"--icon-primary-background": this.styles.iconColor,
				}
            }
        };

        const retryInterval = setInterval(() => {
            this.iframe.contentWindow.postMessage(message, config.frontend_url);

            const acknowledgeMessage = (event) => {
                if (event.data.type === 'iselfietest-sdk-ack') {
                    clearInterval(retryInterval);
                    window.removeEventListener('message', acknowledgeMessage);
                }
            };

            window.addEventListener('message', acknowledgeMessage);
        }, 1000);
    }

    handleIncomingMessages(event) {
        const { type, data } = event.data;
        
        if (type === 'iselfietest-close') this.closeTest();

        if (type === 'iselfietest-complete') {
            this.resolveTest?.(data);
            this.closeTest();
        }

        if (type === 'iselfietest-error') {
            this.rejectTest?.(data);
            this.closeTest();
        }

        console.log("Message received:", event.data);
    }

    startTest(testType) {
        return new Promise((resolve, reject) => {
            this.resolveTest = resolve;
            this.rejectTest = reject;
            this.testType = testType;
    
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
        });
    }    

    closeTest() {
        if (this.iframe) {
            const container = document.getElementById(this.containerId);
            container?.removeChild(this.iframe);
            this.iframe = null;
            console.log("Iframe closed.");
        } else {
            console.log("No iframe to close.");
        }
    }
}

// Global instance
let instance;

export default async function ISelfieTest(options) {
    if (instance) {
        console.warn("SDK is already initialized. Returning the existing instance.");
        return;
    }

    instance = new ISelfieTestInstance(options);
    const result = await instance.verifyApiKey();
    const message = result
        ? "SDK initialized successfully."
        : "Invalid API Key: SDK initialization failed. Please verify your credentials.";
    return {
        success: result,
        message,
        startCardioTest: () => instance.startTest('Cardio'),
        startCovidTest: () => instance.startTest('Covid'),
        closeTest: () => instance.closeTest()
    };
}

// Export functions directly
export const startCardioTest = () => instance?.startTest('Cardio');
export const startCovidTest = () => instance?.startTest('Covid');
export const closeTest = () => instance?.closeTest();
