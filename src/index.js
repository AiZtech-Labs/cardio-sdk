import { dev, prod } from "./config";

// Class representing the iSelfieTest instance
class ISelfieTestInstance {
    constructor(_config) {
        // Initialize class properties
        this.iframe = null;
        this.testType = '';
        this.resolveTest = null;
        this.rejectTest = null;
        this.domain = window.location.origin; // Get the current domain
        this.organization = null;
        this.success = false;

        // Basic configuration
        this.config = _config?.environment === "dev" ? dev : prod; // environment
        this.apiKey = _config?.apiKey || ''; // API key for validation
        this.appUserId = _config?.appUserId || ''; // App user ID
        this.containerId = _config?.containerId || 'iselfietest'; // ID of the container for the iframe

        // Options for customizing the test
        this.options = {
            displayResults: _config?.options?.displayResults || false, // Display results after test
            enablePDFSharing: _config?.options?.enablePDFSharing || false, // Allow sharing results as PDF
            timeZone: _config?.options?.timeZone || 'Etc/UTC', // Time zone for test
            disableAudio: _config?.options?.disableAudio || false, // Disable audio during the test
            language: _config?.options?.language || 'en', // Language for the test interface
            isDarkMode: _config?.options?.isDarkMode || true, // Use dark mode by default
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
        };
    }

    // Method to verify API key with the backend
    async verifyApiKey() {
        try {
            const response = await fetch(`${this.config.backend_url}/sdk/verify`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': this.apiKey // Pass the API key in the request headers
                },
            });
            const result = await response.json();
            this.success = result.success; // Set success based on response
            this.organization = result.organization || null; // Set organization details if available
            return this.success;
        } catch (error) {
            console.error('API call failed:', error);
            this.success = false;
            return false;
        }
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
        this.iframe.src = `${this.config.frontend_url}/sdk/before-cardio-test?isSDK=true`;
        container.appendChild(this.iframe); // Append iframe to the container

        this.iframe.onload = () => {
            console.log("Iframe loaded, sending initial message to parent");
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
					"--icon-primary-background": this.styles.iconColor,
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

    // Method to handle incoming messages from the iframe
    handleIncomingMessages(event) {
        const { type, data } = event.data;

        if (type === 'iselfietest-close') this.closeTest(); // Close the test on 'close' message

        if (type === 'iselfietest-complete') {
            this.resolveTest?.(data); // Resolve the test promise with data
            this.closeTest(); // Close the iframe
        }

        if (type === 'iselfietest-error') {
            this.rejectTest?.(data); // Reject the test promise with error data
            this.closeTest(); // Close the iframe
        }

        console.log("Message received:", event.data);
    }

    // Method to start the test
    startTest(testType) {
        return new Promise((resolve, reject) => {
            this.resolveTest = resolve; // Set resolve handler
            this.rejectTest = reject; // Set reject handler
            this.testType = testType; // Set the type of test
    
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
}

// Global instance of the SDK
let instance;

// Function to initialize the SDK
export default async function ISelfieTest(options) {
    if (instance) {
        console.warn("SDK is already initialized. Returning the existing instance.");
        return;
    }

    instance = new ISelfieTestInstance(options); // Create a new SDK instance
    const result = await instance.verifyApiKey(); // Verify the API key
    const message = result
        ? "SDK initialized successfully."
        : "Invalid API Key: SDK initialization failed. Please verify your credentials.";
    return {
        success: result,
        message,
        startCardioTest: () => instance.startTest('Cardio'), // Start a cardio test
        startCovidTest: () => instance.startTest('Covid'), // Start a COVID test
        closeTest: () => instance.closeTest() // Close the test
    };
}

// Export test control functions
export const startCardioTest = () => instance?.startTest('Cardio');
export const startCovidTest = () => instance?.startTest('Covid');
export const closeTest = () => instance?.closeTest();
