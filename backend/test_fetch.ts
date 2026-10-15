import { getAccessToken } from './src/oauth.js';
import { ZohoClient } from './src/zohoClient.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    const accessToken = await getAccessToken();
    const client = new ZohoClient(accessToken, process.env.ZOHO_REGION || 'in');
    
    let accountId = process.env.ZOHO_ACCOUNT_ID;
    if (!accountId) {
        const accountsRes = await client.getAccounts();
        accountId = accountsRes.data[0].accountId;
    }
    
    const messagesRes = await client.getRecentEmails(accountId as string, 5);
    console.log(JSON.stringify(messagesRes.data, null, 2));
}

test().catch(console.error);
