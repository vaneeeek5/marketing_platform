
const { getSheetNames } = require('./lib/googleSheets');

async function listSheets() {
    try {
        console.log("Fetching sheet names...");
        const names = await getSheetNames();
        console.log("Sheet names:", names);
    } catch (error) {
        console.error("Error fetching sheets:", error);
    }
}

listSheets();
