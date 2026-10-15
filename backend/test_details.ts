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
    
    const folderId = "4598832000000002014";
    const messageId = "1782218666705118200";

    console.log("Fetching attachments info...");
    try {
        const attInfo = await client.getMessageAttachments(accountId as string, folderId, messageId);
        console.log("Attachments data:", JSON.stringify(attInfo.data, null, 2));
    } catch (e: any) {
        console.error("Error:", e.response?.status, e.response?.data || e.message);
    }
}

test().catch(console.error);
