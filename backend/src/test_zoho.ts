import { fetchZohoEmails } from './fetchZohoEmails.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        console.log("Fetching emails...");
        const res = await fetchZohoEmails(5);
        console.log("Success:", res.emails.length);
    } catch (e: any) {
        console.error("Error:", e.message);
        if (e.response) {
            console.error("Response:", e.response.status, e.response.data);
        }
    }
}
run();
