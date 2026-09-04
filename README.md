## Introduction

The iSelfie™ Cardio SDK enables developers to integrate and configure a cardio test feature into their web applications. Below is a detailed breakdown of the initialization parameters, options, and styling attributes available.

## Install the SDK

Add the SDK to your project using npm or include it via a `<script>` tag for direct use.

- **Using npm:**

    ```bash
    npm install @aiztechlabs/cardio-sdk
    ```

- **Using a Script Tag:**

    ```html
    <script src="https://cdn.jsdelivr.net/npm/@aiztechlabs/cardio-sdk@2.0.0/dist/iselfie-cardio-sdk.umd.min.js"></script>
    ```

    Always pin a version in the script URL (as above) so a future release cannot change your integration until you choose to upgrade.

## Initialize the SDK

In case of using NPM, use the following code snippet to initialize the SDK.

```javascript
import iSelfieCardioSDK from '@aiztechlabs/cardio-sdk';

// Using API Key verification method (default)
const sdk = await ISelfieTestSDK({
  apiKey: "your-api-key", // When verificationMethod is 'apikey', this should be your API key
  appUserId: "user-id",
  verificationMethod: "apikey", // Optional: 'apikey' (default) or 'accesstoken' (case insensitive)
  // entitlementSource: "auto", // Optional: 'auto' (default), 'rbac' or 'legacy' — see Initialization Parameters
  options: {
    displayResults: false,
    enablePDFSharing: false,
    timezone: 'Etc/UTC',
    disableAudio: false,
    language: 'en',
    isDarkMode: true,
    disableMotionDetection: false,
    disableLightCheck: false,
    disableDistanceCheck: false,
    terminateTestIfConditionPersisted: false,
    testTerminationTimeOut: 7,
    progressBarPosition: "top",
    showLanguageSelector: true,
    enableMobileCameraSwap: false,
    instructionPage: {
      hidden: false,
      instructionContent: null
    }
  },
  styles: {
    pageBackgroundColor: 'linear-gradient(180deg, #210D2F, #050110)',
    cardBackgroundColor: '#0F0921',
    cardHeaderBackgroundColor: '#0C0418',
    primaryTextColor: '#FFFFFF',
    secondaryTextColor: '#F9F9FACC',
    buttonColor: '#9427EA',
    buttonTextColor: '#FFFFFF',
    iconColor: '#9427EA',
    fontFace: 'MetroSans, sans-serif'
  }
});

// Using Access Token verification method
const sdkWithToken = await ISelfieTestSDK({
  apiKey: "your-access-token", // When verificationMethod is 'accesstoken', this should be your access token
  appUserId: "user-id",
  organizationId: "your-organization-id", // Required when using accesstoken verification
  verificationMethod: "accesstoken", // Case insensitive: 'accesstoken', 'accessToken', 'AccessToken', etc.
  // entitlementSource: "auto", // Optional: 'auto' (default), 'rbac' or 'legacy' — see Initialization Parameters
  options: {
    // ... same options as above
  },
  styles: {
    // ... same styles as above
  }
});

if (sdk.success) {
  // sdk.startCardioTest();
} else {
  console.error(sdk.message);
}
```

In case of using direct script tag for HTML, use the code below.

```html
<script>
  (async function() {
    // Using API Key verification method (default)
    var sdk = await ISelfieTestSDK({
      apiKey: "your-api-key", // When verificationMethod is 'apikey', this should be your API key
      appUserId: "user-id",
      verificationMethod: "apikey", // Optional: 'apikey' (default) or 'accesstoken' (case insensitive)
      // entitlementSource: "auto", // Optional: 'auto' (default), 'rbac' or 'legacy' — see Initialization Parameters
      options: {
        displayResults: false,
        enablePDFSharing: false,
        timezone: 'Etc/UTC',
        disableAudio: false,
        language: 'en',
        isDarkMode: true,
        disableMotionDetection: false,
        disableLightCheck: false,
        disableDistanceCheck: false,
        terminateTestIfConditionPersisted: false,
        testTerminationTimeOut: 7,
        progressBarPosition: "top",
        showLanguageSelector: true,
        enableMobileCameraSwap: false,
        instructionPage: {
          hidden: false,
          instructionContent: null
        }
      },
      styles: {
        pageBackgroundColor: 'linear-gradient(180deg, #210D2F, #050110)',
        cardBackgroundColor: '#0F0921',
        cardHeaderBackgroundColor: '#0C0418',
        primaryTextColor: '#FFFFFF',
        secondaryTextColor: '#F9F9FACC',
        buttonColor: '#9427EA',
        buttonTextColor: '#FFFFFF',
        iconColor: '#9427EA',
        fontFace: 'MetroSans, sans-serif'
      }
    });

    if (sdk.success) {
      // Start the Cardio Test
      document.body.insertAdjacentHTML(
        'beforeend',
        '<button id="start-cardio" style="margin: 10px; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 5px;">Start Cardio Test</button>'
      );

      document.getElementById('start-cardio').addEventListener('click', function() {
        sdk.startCardioTest();
      });

      // Close the Test
      document.body.insertAdjacentHTML(
        'beforeend',
        '<button id="close-test" style="margin: 10px; padding: 10px; background-color: #ff4d4f; color: white; border: none; border-radius: 5px;">Close Test</button>'
      );

      document.getElementById('close-test').addEventListener('click', function() {
        sdk.closeTest();
      });
    } else {
      console.error(sdk.message);
    }
  })();
</script>
```

## Initialization Parameters

**`apiKey`**: (string)  
Your authentication credential for the SDK. The value depends on the `verificationMethod` used:
- When `verificationMethod` is `"apikey"` (default): This should be your **API key**
- When `verificationMethod` is `"accesstoken"`: This should be your **access token**  
**Example**: `"your-api-key"` or `"your-access-token"`  

**`appUserId`**: (string)  
A unique identifier for the user running the cardio test. This value is optional and will be returned as part of the response together with the vital measurements if a webhook is configured.  
**Example**: `"1"`  

**`organizationId`**: (string, optional)  
The organization ID associated with your account. This parameter is **required** when using `verificationMethod: "accesstoken"`. It is not needed when using the default API key verification method.  
**Example**: `"673f477ac141e45a54e76b7a"`  

**`verificationMethod`**: (`"apikey"` | `"accesstoken"`) - Case insensitive  
Specifies the authentication method to use for SDK verification.  
- **`"apikey"`** (default): Uses API key authentication via HTTP header. This is the default method and maintains backward compatibility.  
- **`"accesstoken"`**: Uses access token authentication via POST request body. When using this method, you must also provide the `organizationId` parameter.  
**Note**: This parameter is case insensitive, so `"accesstoken"`, `"accessToken"`, `"AccessToken"`, etc. are all valid.  
**Default**: `"apikey"`  
**Example**: `"apikey"` or `"accessToken"`  

**`entitlementSource`**: (`"auto"` | `"rbac"` | `"legacy"`, optional) - Case insensitive  
Selects how the SDK decides whether a cardio test may start.  
- **`"auto"`** (default since 2.0.0): Follows the server whenever the organization status endpoint returns an entitlement block **and** says it is enforcing; otherwise runs the legacy client-side checks. Once a server enforces, its answer is what the results call will be judged by, so this is the mode that never disagrees with the server.  
- **`"rbac"`**: Gates on the server's entitlement block whenever one is present, even when the server reports it is not enforcing (in which case it allows). Falls back to the legacy checks only when no block is sent.  
- **`"legacy"`**: Never looks at the block. Checks the organization's account type, trial window and subscription usage client-side, exactly as releases before 2.0.0 did by default.  
Every mode keeps working against a server that sends no block.  
**Default**: `"auto"`  
**Example**: `"legacy"`  

## Options

A set of configurable features for customizing the cardio test behavior:

**`displayResults`**: (boolean)  
Determines whether the test results should be displayed after test completion.  
**Default**: `false`  

**`enablePDFSharing`**: (boolean)  
Allows the test results to be shared as a PDF file.  
**Default**: `false`  

**`timezone`**: (string)  
Sets the time zone for scheduling and timestamping the test. Use IANA time zone format: [https://timeapi.io/documentation/iana-timezones](https://timeapi.io/documentation/iana-timezones).  
**Default**: `"Etc/UTC"`  

**`disableAudio`**: (boolean)  
Controls whether audio guidance is enabled during the test. If `true`, audio is muted.  
**Default**: `false`  

**`language`**: (`"en" | "es" | "ar"`)  
Sets the language for the test interface. Currently, `"en"`, `"es"`, and `"ar"` languages are supported.  
**Default**: `"en"`  

**`isDarkMode`**: (boolean)  
Enables dark mode for the test interface if set to `true`. This will be ignored if the style options are set.  
**Default**: `true`  

**`disableMotionDetection`**: (boolean)  
When set to `true`, motion detection is disabled during the test. If excessive motion is detected while this option is disabled, a warning message may be displayed. Additionally, the test may be terminated if the `terminateTestIfConditionPersisted` option is enabled.  
**Default**: `false`  

**`disableLightCheck`**: (boolean)  
Skips the light level check during the test if set to `true`. If poor lighting conditions, such as being in a dark room, are detected, a warning message will be displayed. Additionally, the test may be terminated if the `terminateTestIfConditionPersisted` option is enabled.  
**Default**: `false`  

**`disableDistanceCheck`**: (boolean)  
Disables the distance check for the user's position relative to the camera. The recommended distance from the camera is between 8 inches (20 cm) and 15 inches (38 cm). If a greater distance is detected, a warning message will be displayed, and the test may be terminated if the `terminateTestIfConditionPersisted` option is enabled.  
**Default**: `false`  

**`terminateTestIfConditionPersisted`**: (boolean)  
If set to `true`, the test will automatically terminate if a persistent failure condition is detected (e.g., inadequate lighting, improper distance, or excessive motion). Additionally, the test will end if a face is not detected within the frame. The termination will occur after waiting for the duration specified in the `testTerminationTimeOut` option.  
**Default**: `false`  

**`testTerminationTimeOut`**: (number)  
The duration (in seconds) to wait before terminating the test after detecting a persistent failure condition.  
**Default**: `7`  

**`progressBarPosition`**: (`"top" | "bottom"`)  
This option will show the progress bar either on top or bottom of the video/camera feed.
**Default**: `bottom`  

**`showLanguageSelector`**: (boolean)  
This option will show or hide the language selector.
**Default**: `true`  

**`enableMobileCameraSwap`**: (boolean)  
On phones and tablets (non-desktop browsers), when set to `true`, the live test shows a control that lets the user switch between the front (user) and rear (environment) camera. No effect on desktop. You can also persist this flag in organization `options` so partner embeds merge it with other defaults.  
**Default**: `false`  

**`instructionPage`**: (object)  
Customization options for the instruction page displayed before the test starts:

- **`hidden`**: (boolean)    
  Determines whether the instruction page is shown.  
  **Default**: `false`  

- **`instructionContent`**: (object | null)    
  Custom content to display on the instruction page. If `null`, the default content is used.

## Styles

This option is used for customizing the appearance of the test interface:

- **`pageBackgroundColor`**: (string)  
  Background color of the entire page.  
  **Default (Dark mode)**: `linear-gradient(180deg, #210D2F, #050110)`  
  **Default (Light mode)**: `#FFFFFF`

- **`cardBackgroundColor`**: (string)  
  Background color of the main test card.  
  **Default (Dark mode)**: `#0F0921`  
  **Default (Light mode)**: `#FFFFFF`

- **`cardHeaderBackgroundColor`**: (string)  
  Background color of the card's header section.  
  **Default (Dark mode)**: `#0C0418`  
  **Default (Light mode)**: `#FFFFFF`

- **`primaryTextColor`**: (string)  
  Color for primary text elements.  
  **Default (Dark mode)**: `#FFFFFF`  
  **Default (Light mode)**: `#000000`

- **`secondaryTextColor`**: (string)  
  Color for secondary text elements.  
  **Default (Dark mode)**: `#F9F9FACC`  
  **Default (Light mode)**: `#434651`

- **`buttonColor`**: (string)  
  Background color of buttons.  
  **Default (Dark mode)**: `#9427EA`  
  **Default (Light mode)**: `#000000`

- **`buttonTextColor`**: (string)  
  Text color for button labels.  
  **Default (Dark mode)**: `#FFFFFF`  
  **Default (Light mode)**: `#FFFFFF`

- **`iconColor`**: (string)  
  Color for icons displayed in the interface.  
  **Default (Dark mode)**: `#9427EA`  
  **Default (Light mode)**: `#000000`

- **`fontFace`**: (string)  
  Specifies the font face to be used for text.  
  **Default**: `"MetroSans"`


## Instruction Page Content Configuration

This section defines the content of the instruction page in a structured text format. It allows for multilingual support, directional customization, and rich content presentation with icons, headers, titles, and optional subtitles.


**`type`**: (`"text"` | `"html"`)  
Specifies the format of the instruction content.  
**Values**:  
- **`"text"`**: Indicates a text-based instruction format.  
- **`"html"`**: Indicates an HTML-based instruction format.  

**`instructions`**: (array of objects)  
An array containing the instruction content for different languages. Each object represents instructions in a specific language.

### Instruction Object Properties:

- **`lang`**: (`"en"` | `"es"` | `"ar"`)    
  The language code for the instruction content (e.g., `"en"` for English, `"es"` for Spanish, `"ar"` for Arabic).

- **`direction`**: (`"ltr"` | `"rtl"`)    
  Specifies the text direction.  
  **Values**:  
  - `"ltr"`: Left-to-right (e.g., English, Spanish).
  - `"rtl"`: Right-to-left (e.g., Arabic).

- **`header`**: (string)    
  The main header text displayed at the top of the instruction page.

- **`content`**: (array of objects)    
    A list of instruction items, where each item contains an icon, a title, and an optional subtitle.

    #### Content Item Properties:

    Each content item in the `content` array has the following attributes:

    - **`icon`**: (string)    
    The URL or path to the icon representing the instruction.

    - **`title`**: (string)    
    The title text for the instruction.

    - **`subtitle`**: (string, optional)    
    An optional subtitle providing additional details for the instruction.

### Example Configuration

```javascript
{
  "type": "text",
  "instructions": [
    {
      "lang": "en",
      "direction": "ltr",
      "header": "Custom instruction info",
      "content": [
        { "icon": "icon_url", "title": "Instruction 1", "subtitle": "Instruction 1" },
        { "icon": "icon_url", "title": "Instruction 2", "subtitle": "Instruction 2" }
      ]
    },
    {
      "lang": "es",
      "direction": "ltr",
      "header": "Información de instrucción personalizada",
      "content": [
        { "icon": "icon_url", "title": "Instrucción 1", "subtitle": "Instrucción 1" },
        { "icon": "icon_url", "title": "Instrucción 2", "subtitle": "Instrucción 2" }
      ]
    },
    {
      "lang": "ar",
      "direction": "rtl",
      "header": "معلومات التعليمات المخصصة",
      "content": [
        { "icon": "icon_url", "title": "تعليمات 1", "subtitle": "تعليمات 1" },
        { "icon": "icon_url", "title": "تعليمات 2", "subtitle": "تعليمات 2" }
      ]
    }
  ]
}

{
  type: "html",
  instructions: [
    {
      lang: "en",
      direction: "ltr",
      header: "<p>Custom instruction info</p>",
      content: "<p><img width='30' src='icon_url' /> Instruction 1</p><p><img width='30' src='icon_url' /> Instruction 2</p>",
    },
    {
      lang: "es",
      direction: "ltr",
      header: "<p>Información de instrucción personalizada</p>",
      content: "<p><img width='30' src='icon_url' /> Instrucción 1</p><p><img width='30' src='icon_url' /> Instrucción 2</p>",
    },
    {
      lang: "ar",
      direction: "rtl",
      header: "<p>معلومات التعليمات المخصصة</p>",
      content: "<p><img width='30' src='icon_url' /> تعليمات 1</p><p><img width='30' src='icon_url' /> تعليمات 2</p>",
    },
  ],
}
```

### Behavior

- The SDK dynamically selects the appropriate instruction content based on the selected language.
- Text direction is adjusted to match the specified direction (`ltr` or `rtl`).
- Icons, titles, and subtitles are displayed sequentially on the instruction page, providing clear guidance before the test begins. If no icon is needed, use an empty string as the URL.

## Start Cardio Test

The `startCardioTest()` method initiates the cardio test process. This method can be used in both Node.js environments (with npm) and in client-side applications using a script tag. Upon completion, it returns a promise that resolves with the test results or rejects with an error.

- ### Using npm:
    ```javascript
    sdk.startCardioTest()
    .then(function(result) {
        // Do something with result of cardio test
    })
    .catch(function(error) {
        console.error('Error cardio test:', error);
    });
    ```

    #### Explanation

    - `sdk.startCardioTest()`: Initiates the cardio test.
    - `.then(function(result) {...})`: Executes the success callback function when the test completes, providing the result of the test.
    - `.catch(function(error) {...})`: Executes the error callback function if the test fails, providing the error information.

- ### Using a Script Tag:
    ```html
    <script>
    sdk.startCardioTest()
        .then(function(result) {
            // Do something with result of cardio test
        })
        .catch(function () {
            console.error('Error cardio test:', error);
        });
    </script>
    ```

    #### Explanation

    - `sdk.startCardioTest()`: Begins the cardio test process.
    - `.then(function(result) {...})`: Executes when the test completes successfully, passing the test result to the callback function.
    - `.catch(function(error) {...})`: Captures and handles any errors that occur during the test execution.

    #### Behavior

    - Success (`.then`): The test results are returned in the result object. This can include details such as measurements, timestamps, and test-specific outcomes.
    - Error (`.catch`): Any issues during the test (e.g., connection failures, user interruptions, or invalid configurations) are captured as error for logging or user feedback. The rejection is an `Error`; when the SDK refused the test, the embedded test reported a coded error, or the test was closed before completing, `error.code` carries one of the codes listed under [Error Codes](#error-codes).

**Note**: Ensure that the SDK is properly initialized before calling `startCardioTest()`. Due to iOS restrictions requiring playback to be initiated through user interaction, the `disableAudio` option   cannot be set to false (audio enabled) while the `instructionPage.hidden` option is set to true. In this scenario, the SDK displays a "Continue" button without additional instructions, allowing users to initiate audio playback on the test screen.

When a webhook is configured through the developer dashboard, it will be triggered upon the completion of the test. The data sent to the webhook is in JSON format and follows the structure shown in the example below.

**Important**: We consider only HTTP status code 200 as a successful response for webhook calls to your endpoint.  

 ```javascript
{
  "data": {
    "organizationId": "673f477ac141e45a54e76b7a",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "cardio_api_version": "1",
    "hr": {
      "value": 86,
      "irregular": false,
      "confidence": "medium"
    },
    "hrv": 36,
    "rr": 23,
    "spo2": 99,
    "bp": {
      "systolic": 124,
      "diastolic": 67
    },
    "error": null,
    "app_user_id": "1",
    "_id": "6780728427deef27cc27dd26",
    "createdAt": "2025-01-10T01:06:12.159Z",
    "updatedAt": "2025-01-10T01:06:12.159Z"
  }
}
```

## Error Codes

When initialization is refused, `sdk.isAvailable.code` carries one of the codes below and `sdk.message` the matching description. `startCardioTest()` rejects with an `Error` whose `error.code` is set to the same codes. This includes the cases where the embedded test page reports a coded error and where the test is closed before it completes, so a pending `startCardioTest()` promise always settles. The npm package also exports the map as `ERROR_CODES` (for example `ERROR_CODES.AIZERR001.code === 'AIZERR001'`).

| Code | Description |
| --- | --- |
| `AIZERR001` | Trial expired |
| `AIZERR002` | Trial usage limit exceeded |
| `AIZERR003` | Active subscription usage limit exceeded |
| `AIZERR004` | No active subscription. Also returned when the organization status or subscription request fails with an HTTP error other than 401/403/404, or with a network error. |
| `AIZERR005` | Domain not allowed or invalid API key. `ERROR_CODES.AIZERR006` is kept as an alias of this entry for integrations that referenced the old key. |
| `AIZERR007` | Invalid organization ID. Also returned when the organization status or subscription request answers 404. |
| `AIZERR008` | Invalid access token (`verificationMethod: "accesstoken"`). Also returned when the API answers 401/403 to the organization status or subscription request. |
| `AIZERR009` | Invalid API key (`verificationMethod: "apikey"`). Also returned when the API answers 401/403 to the organization status or subscription request. |
| `AIZERR010` | Product not entitled (`entitlementSource: "rbac"` and the server reports that the cardio product is not entitled). |
| `AIZERR011` | Test cancelled. The embedded test was closed before it completed, so the pending `startCardioTest()` promise rejects instead of staying pending. |
| `AIZERR012` | The service could not be reached, or it failed. Returned when verification gets no reply at all (offline, DNS, TLS, a connection reset, a blocked cross-origin request) and when it answers 5xx. Deliberately distinct from `AIZERR008`/`AIZERR009`: nothing here says the credential is bad, and renewing one will not help. |

## Test Result Response

The JSON response contains detailed information about a completed cardio test. The structure includes metadata about the test results, and related identifiers.

## Shape: JSON Response Fields

- **`organizationId`**: (string)    
  Unique identifier for the organization.

- **`user_agent`**: (string)    
  Identifies the client making the request (e.g., Postman).

- **`cardio_api_version`**: (string)    
  API version being used.

- **`hr`**: (object)    
  Contains heart rate details:  
  - **`value`**: (number)    
    Heart rate measurement.  
  - **`irregular`**: (boolean)    
    Indicates if the heart rate is irregular.  
  - **`confidence`**: (`"Low"` | `"Medium"` | `"High"`)    
    Confidence level of the measurement.

- **`hrv`**: (number)    
  Heart rate variability measurement.

- **`rr`**: (number)    
  Respiratory rate measurement.

- **`spo2`**: (number)    
  Oxygen saturation level.

- **`bp`**: (object)    
  Blood pressure details:  
  - **`systolic`**: (number)    
    Systolic blood pressure.  
  - **`diastolic`**: (number)    
    Diastolic blood pressure.

- **`error`**: (string | null)    
  Contains error information if any occurs (`null` if no error).

- **`app_user_id`**: (string)    
  Application-specific user identifier.

- **`_id`**: (string)    
  Unique identifier for the test result object.

- **`createdAt`**: (Date)    
  Record creation timestamp. Unique identifier for the webhook event.

- **`updatedAt`**: (Date)    
  Record update timestamp. Unique identifier for the webhook event.

## Test Result Response

The JSON response contains detailed information about a completed cardio test. The structure includes metadata about the test results, and related identifiers.

## Shape: JSON Response Fields

- **`organizationId`**: (string)    
  Unique identifier for the organization.

- **`user_agent`**: (string)    
  Identifies the client making the request (e.g., Postman).

- **`cardio_api_version`**: (string)    
  API version being used.

- **`hr`**: (object)    
  Contains heart rate details:  
  - **`value`**: (number)    
    Heart rate measurement.  
  - **`irregular`**: (boolean)    
    Indicates if the heart rate is irregular.  
  - **`confidence`**: (`"Low"` | `"Medium"` | `"High"`)    
    Confidence level of the measurement.

- **`hrv`**: (number)    
  Heart rate variability measurement.

- **`rr`**: (number)    
  Respiratory rate measurement.

- **`spo2`**: (number)    
  Oxygen saturation level.

- **`bp`**: (object)    
  Blood pressure details:  
  - **`systolic`**: (number)    
    Systolic blood pressure.  
  - **`diastolic`**: (number)    
    Diastolic blood pressure.

- **`error`**: (string | null)    
  Contains error information if any occurs (`null` if no error).

- **`app_user_id`**: (string)    
  Application-specific user identifier.

- **`_id`**: (string)    
  Unique identifier for the test result object.

- **`createdAt`**: (Date)    
  Record creation timestamp. Unique identifier for the webhook event.

- **`updatedAt`**: (Date)    
  Record update timestamp. Unique identifier for the webhook event.

## Events

Events are generated when the webhook is triggered following a successful test result. These events include details about the test results and the status of the webhook trigger (success or failure).

### Top-Level Fields

- **`_id`**: (string)    
  Unique identifier for the webhook event.

- **`organizationId`**: (string)    
  The unique identifier of the organization associated with the test.

- **`type`**: (string)    
  Specifies the type of event.  
  **Value**: `"webhook"` (indicating a webhook trigger).  

- **`eventId`**: (string)    
  A unique identifier for the specific webhook event.

- **`status`**: (`"success"` | `"failure"`)    
  The value is set to `"success"` indicating the webhook was successfully triggered and got a 200 response status from the webhook URL. The value is set to `"failure"` indicating the webhook was not successfully triggered and got a code other than 200.

- **`test`**: (object)    
  Contains detailed information about the cardio test. See **Test Object Fields** below.

- **`testType`**: (string)    
  Specifies the type of test conducted.  
  **Value**: `"cardio"`  

- **`responseStatus`**: (number)    
  The HTTP response status code from the webhook endpoint.  
  **Value**: `200` (indicating success)    
  **Note**: We only accept 200 HTTP status codes as successful webhook calls to your endpoint.  

- **`responseData`**: (string)    
  The response data (if any) from the webhook endpoint.

- **`createdAt`**: (Date)    
  Timestamp indicating when the webhook event was created.  
  **Format**: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)  

- **`updatedAt`**: (Date)    
  Timestamp indicating when the webhook event was last updated.  
  **Format**: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)  

## Shape: Test Object Fields

- **`organizationId`**: (string)    
  Identifier of the organization associated with this specific test.

- **`user_agent`**: (string)    
  Information about the user agent (browser or device) used during the test.

- **`cardio_api_version`**: (string)    
  The API version used for the test.  
  **Value**: `"1"`  

- **`hr`**: (object)    
  Details about the heart rate measurement:  
  - **`value`**: (number)    
    The measured heart rate in beats per minute (BPM).  
    **Example**: `86`    
  - **`irregular`**: (boolean)    
    Indicates if the heart rate was irregular.  
    **Example**: `false`    
  - **`confidence`**: (`"Low"` | `"Medium"` | `"High"`)    
    Confidence level in the measurement.  
    **Example**: `"Medium"`  

- **`hrv`**: (number)    
  Heart rate variability in milliseconds (ms).  
  **Example**: `36`  

- **`rr`**: (number)    
  Respiratory rate in breaths per minute.  
  **Example**: `23`  

- **`spo2`**: (number)    
  Blood oxygen saturation percentage.  
  **Example**: `99`  

- **`bp`**: (object)    
  Blood pressure readings:  
  - **`systolic`**: (number)    
    Systolic pressure in mmHg.  
    **Example**: `124`    
  - **`diastolic`**: (number)    
    Diastolic pressure in mmHg.  
    **Example**: `67`  

- **`error`**: (string | null)    
  Error information, if any.  
  **Value**: `null` (indicating no errors)  

- **`app_user_id`**: (string)    
  Identifier for the user within the application.  
  **Example**: `"1"`  

- **`_id`**: (string)    
  Unique identifier for this specific test record.

- **`createdAt`**: (Date)    
  Timestamp indicating when the webhook event was created.  
  **Format**: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)

- **`updatedAt`**: (Date)    
  Timestamp indicating when the webhook event was last updated.  
  **Format**: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)

#### Behavior

- After a successful test, the test result is sent to the configured webhook, if available.
- If the webhook API endpoint responds with an HTTP status code of 200, it is considered a successful API call, and an event record is created for that call.
- If the endpoint returns any status code other than 200, the system will retry up to 10 times at 10-minute intervals.
- If multiple attempts fail, an email is sent to the organization team members to notify them of the webhook failure (if this option is selected on the developer dashboard).

## Example Use Case

The webhook response provides a comprehensive set of data about the test results, which can be used for:

- **Analytics**: Aggregating metrics like heart rate, respiratory rate, and blood pressure.
- **User Feedback**: Sending test outcomes back to the user.
- **Error Handling**: Logging and addressing any issues detected during the test.

## Changelog

### 2.0.0

- `entitlementSource` defaults to `"auto"`: when the server returns an entitlement block and reports that it is enforcing, the SDK follows the server's answer before opening the camera; otherwise it runs the legacy checks. Pass `entitlementSource: "legacy"` to keep the pre-2.0 behaviour. This is the only behaviour change, and it only applies against a server that enforces entitlements.
- Before each `startCardioTest()`, an access token with less than two minutes left is renewed through the server's refresh exchange, so a second test in the same session does not start on a lapsed credential. Best effort: a server without the refresh route, or a token past its renewal cap, keeps the current token.
- Everything in 0.1.16 below.

### 0.1.16

Robustness-only patch. No behaviour change for a working integration.

- Non-2xx responses from the verify, organization status and subscription endpoints are handled explicitly: 401/403 map to `AIZERR008` or `AIZERR009` (by `verificationMethod`), other statuses to `AIZERR004`. Non-JSON response bodies no longer throw.
- **Verification failures now say what actually failed.** Every failure of `verifyApiKey()` used to be reported as `AIZERR008` / `AIZERR009` — a statement about the credential — including a request that never got a reply. A page showing "this link has expired" for a CORS block or an outage sends people to renew a credential that was never the problem. A thrown fetch and a 5xx are now `AIZERR012`, a 404 is `AIZERR007`, and only a real rejection (401/403, or a 200 that says no) reports the credential. Integrators matching on `AIZERR008` to trigger a token refresh should add `AIZERR012` as a retry-or-report case instead.
- `startCardioTest()` can no longer stay pending forever: internal failures reject the promise, and a test closed before completing rejects with `AIZERR011`. Errors reported by the embedded test reject with an `Error` carrying `error.code`.
- A `null` subscription list from the server is treated as empty instead of crashing.
- The embedded test can hand a renewed access token up to the SDK (`iselfietest-credential` message); the SDK adopts it for later calls.
- `ERROR_CODES.AIZERR006` is restored as an alias of `ERROR_CODES.AIZERR005` (same `'AIZERR005'` code). New `AIZERR011` (Test cancelled).

### 0.1.15

- New `entitlementSource` option (`'legacy'` default, `'rbac'`). With `'rbac'` the SDK gates on the server's enforced entitlement block returned by the organization status endpoint and falls back to the legacy checks when the server sends none.
- New error code `AIZERR010` (Product not entitled).
- An expired trial is reported as `AIZERR001` (not `AIZERR010`) on the rbac path.