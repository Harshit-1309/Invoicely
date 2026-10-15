import { ZohoBooksClient } from './src/zohoBooksClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        const client = new ZohoBooksClient();
        console.log("Fetching contacts...");
        const data = await client.getContacts('vendor');
        console.log(`Success! Fetched ${data.contacts?.length} vendors.`);
    } catch (err: any) {
        console.error("Failed:", err.response?.data || err.message);
    }
}

test();
