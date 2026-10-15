import 'dotenv/config';
import { ZohoBooksClient } from './src/zohoBooksClient.js';
import mongoose from 'mongoose';

async function run() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zoho_agent');
    const client = new ZohoBooksClient();
    try {
        const res = await client.getPurchaseOrders();
        console.log(JSON.stringify(res, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
