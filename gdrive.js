// Google Drive Sync Logic using drive.appdata scope
// This allows the app to store a hidden configuration file on the user's personal Google Drive.

const CLIENT_ID = '202960005617-pkti921f235sfkaul9kre2boueu3nu8j.apps.googleusercontent.com';
const API_KEY = 'AIzaSyDdHqBQTOA1HzpNrGeKjOlj7_beZ9rxu0o';

// Scope for application data folder
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const FILENAME = 'money_flow_database.json';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let fileId = null; // The ID of the database file on Google Drive

// Polling to fix race conditions with async scripts
function waitForGoogleAPIs() {
    if (window.gapi && window.google) {
        gapi.load('client', initializeGapiClient);
        
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined later
        });
        gisInited = true;
        checkIfReady();
    } else {
        setTimeout(waitForGoogleAPIs, 100);
    }
}
waitForGoogleAPIs(); // Start polling

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

async function checkIfReady() {
    if (gapiInited && gisInited) {
        const savedTokenStr = localStorage.getItem('wimm_google_token');
        let restored = false;
        let needsRefresh = false;

        if (savedTokenStr) {
            try {
                const savedData = JSON.parse(savedTokenStr);
                if (Date.now() < savedData.expiresAt) {
                    gapi.client.setToken(savedData.token);
                    await findOrCreateDatabase();
                    restored = true;
                } else {
                    needsRefresh = true;
                }
            } catch (e) {
                localStorage.removeItem('wimm_google_token');
            }
        }
        
        if (needsRefresh) {
            try {
                await loginGoogle(true);
                restored = true;
            } catch (err) {
                console.error("Silent refresh failed:", err);
                localStorage.removeItem('wimm_google_token');
            }
        }
        
        window.dispatchEvent(new Event('google_api_ready'));
    }
}

// -----------------------------------------------------------------------------
// Authentication Flow
// -----------------------------------------------------------------------------

export function loginGoogle(silent = false) {
    return new Promise((resolve, reject) => {
        if (!CLIENT_ID || CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
            alert('Google Client ID is not configured.');
            reject('Unconfigured Client ID');
            return;
        }
        
        if (!tokenClient) {
            alert('Google Login is still initializing. Please wait a moment and try again.');
            reject('tokenClient not initialized');
            return;
        }

        try {
            tokenClient.callback = async (resp) => {
                if (resp.error !== undefined) {
                    reject(resp);
                    throw (resp);
                }
                
                const tokenObj = gapi.client.getToken();
                localStorage.setItem('wimm_google_token', JSON.stringify({
                    token: tokenObj,
                    expiresAt: Date.now() + (resp.expires_in * 1000)
                }));
                
                await findOrCreateDatabase();
                resolve();
            };
            
            if (silent) {
                tokenClient.requestAccessToken({prompt: ''});
            } else if (gapi.client.getToken() === null) {
                tokenClient.requestAccessToken({prompt: 'consent'});
            } else {
                tokenClient.requestAccessToken({prompt: ''});
            }
        } catch (err) {
            reject(err);
        }
    });
}

export function logoutGoogle() {
    localStorage.removeItem('wimm_google_token');
    if (gapi && gapi.client) {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token, () => {
                gapi.client.setToken('');
                fileId = null;
                window.dispatchEvent(new Event('google_logged_out'));
            });
        }
    }
}

export function isGoogleLoggedIn() {
    return gapi && gapi.client && gapi.client.getToken() !== null;
}

// -----------------------------------------------------------------------------
// Drive API Operations
// -----------------------------------------------------------------------------

async function findOrCreateDatabase() {
    try {
        const response = await gapi.client.drive.files.list({
            spaces: 'appDataFolder',
            q: `name='${FILENAME}'`,
            fields: 'files(id, name)'
        });
        
        const files = response.result.files;
        if (files && files.length > 0) {
            fileId = files[0].id;
        } else {
            fileId = await createEmptyDatabase();
        }
    } catch (err) {
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
        return response.result;
    } catch (err) {
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
        mimeType: contentType
    };
    if (isNewFile || !fileId) {
        metadata.parents = ['appDataFolder'];
    }

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + contentType + '\r\n\r\n' +
        JSON.stringify(dataObj) +
        close_delim;

    let path = '/upload/drive/v3/files';
    let method = 'POST';

    if (!isNewFile && fileId) {
        path += '/' + fileId;
        method = 'PATCH';
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
                    reject(file.error);
                } else {
                    resolve(file.id);
                }
            });
        });
    } catch (err) {
        throw err;
    }
}
