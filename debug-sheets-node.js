const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = "1V9s3qmv1cEf-2BmCfGdkKHJfrCppXHHQxIQNz7vSl3c";

// Simple manual env parser
function loadEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            let key = match[1].trim();
            let value = match[2].trim();
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            env[key] = value;
        }
    });
    return env;
}

const envLocal = loadEnv('.env.local');
const envMain = loadEnv('.env');
const env = { ...envMain, ...envLocal }; // local overrides main

async function listSheets() {
    try {
        console.log("Auth with:", env.GOOGLE_CLIENT_EMAIL);

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: env.GOOGLE_CLIENT_EMAIL,
                private_key: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            },
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const sheets = google.sheets({ version: "v4", auth });

        console.log("Fetching sheets for ID:", SPREADSHEET_ID);
        const response = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID,
        });

        const sheetNames = response.data.sheets?.map((sheet) => sheet.properties?.title || "") || [];
        console.log("Sheet names:", JSON.stringify(sheetNames, null, 2));

    } catch (error) {
        console.error("Error:", error.message);
        if (error.response) {
            console.error("Details:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

listSheets();
