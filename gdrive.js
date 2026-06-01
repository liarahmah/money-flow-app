// Google Drive Sync Logic using drive.appdata scope
// This allows the app to store a hidden configuration file on the user's personal Google Drive.

// TODO: Replace these with your actual credentials from Google Cloud Console
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE';
const API_KEY = 'YOUR_GOOGLE_API_KEY_HERE';

// Scope for application data folder
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const FILENAME = 'money_flow_database.json';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let fileId = null; // The ID of the database file on Google Drive

// Expose initialize methods to window so index.html can call them on script load
window.gapiLoaded = function() {
    gapi.load('client', initializeGapiClient);
};

window.gisLoaded = function() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later in handleAuthClick
    });
    gisInited = true;
    checkIfReady();
};

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        checkIfReady();
    } catch (err) {
        console.error('Error initializing GAPI client', err);
    }
}

function checkIfReady() {
    if (gapiInited && gisInited) {
        // Dispatch an event so the UI knows Google APIs are ready
        window.dispatchEvent(new Event('google_api_ready'));
    }
}

// -----------------------------------------------------------------------------
// Authentication Flow
// -----------------------------------------------------------------------------

export function loginGoogle() {
    return new Promise((resolve, reject) => {
        if (!CLIENT_ID || CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
            alert('Google Client ID is not configured. The developer needs to add this in gdrive.js');
            reject('Unconfigured Client ID');
            return;
        }

        try {
            tokenClient.callback = async (resp) => {
                if (resp.error !== undefined) {
                    reject(resp);
                    throw (resp);
                }
                // Token acquired successfully
                await findOrCreateDatabase();
                resolve();
            };

            if (gapi.client.getToken() === null) {
                // Prompt user to select account
                tokenClient.requestAccessToken({prompt: 'consent'});
            } else {
                // Skip consent if already authorized
                tokenClient.requestAccessToken({prompt: ''});
            }
        } catch (err) {
            reject(err);
        }
    });
}

export function logoutGoogle() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            gapi.client.setToken('');
            fileId = null;
            window.dispatchEvent(new Event('google_logged_out'));
        });
    }
}

export function isGoogleLoggedIn() {
    return gapi.client && gapi.client.getToken() !== null;
}

// -----------------------------------------------------------------------------
// Drive API Operations
// -----------------------------------------------------------------------------

async function findOrCreateDatabase() {
    try {
        // Search for the file in the hidden appDataFolder
        const response = await gapi.client.drive.files.list({
            spaces: 'appDataFolder',
            q: `name='${FILENAME}'`,
            fields: 'files(id, name)'
        });
        
        const files = response.result.files;
        if (files && files.length > 0) {
            console.log('Database found on Google Drive.');
            fileId = files[0].id;
        } else {
            console.log('Database not found. Creating a new one on Google Drive...');
            fileId = await createEmptyDatabase();
        }
    } catch (err) {
        console.error('Error finding/creating database', err);
        throw err;
    }
}

async function createEmptyDatabase() {
    const defaultData = {
        transactions: [],
        categories: [
            { name: "Salary", budgets: {} },
            { name: "Food", budgets: {} },
            { name: "Transport", budgets: {} },
            { name: "Entertainment", budgets: {} }
        ],
        banks: [
            { name: "Cash", initialBalance: 0, initialDate: '' },
            { name: "Bank Account", initialBalance: 0, initialDate: '' }
        ],
        subscriptions: [],
        debts: []
    };
    
    return await saveToDrive(defaultData, true);
}

export async function loadDataFromDrive() {
    if (!fileId) {
        throw new Error("No fileId available. Make sure to login first.");
    }

    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        
        return response.result; // This will be the parsed JSON object
    } catch (err) {
        console.error('Error loading data from Drive', err);
        throw err;
    }
}

export async function saveToDrive(dataObj, isNewFile = false) {
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const contentType = 'application/json';
    const metadata = {
        name: FILENAME,
        mimeType: contentType,
        parents: ['appDataFolder']
    };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        JSON.stringify(dataObj) +
        close_delim;

    let path = '/upload/drive/v3/files';
    let method = 'POST'; // POST for creating new

    if (!isNewFile && fileId) {
        path += '/' + fileId;
        method = 'PATCH'; // PATCH for updating existing
    }

    try {
        const request = gapi.client.request({
            path: path,
            method: method,
            params: { uploadType: 'multipart' },
            headers: {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"'
            },
            body: multipartRequestBody
        });
        
        return new Promise((resolve, reject) => {
            request.execute(function(file) {
                if (file.error) {
                    console.error('Error saving to Drive:', file.error);
                    reject(file.error);
                } else {
                    console.log('Saved to Drive successfully.');
                    resolve(file.id);
                }
            });
        });
    } catch (err) {
        console.error('Exception during saveToDrive:', err);
        throw err;
    }
}
