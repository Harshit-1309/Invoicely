import { getAccessToken } from './oauth.js';
import type { ZohoCredentials } from './oauth.js';
import { ZohoClient } from './zohoClient.js';

export async function fetchZohoAttachments(messageId: string, folderId: string, attachmentId?: string, credentials?: ZohoCredentials) {
    let finalCredentials: any = credentials || {};
    
    try {
        const { Connection } = await import('./models/Connection.js');
        const zohoMailConn = await Connection.findOne({ connectionId: 'zoho-mail' });
        const dbCreds = zohoMailConn?.credentials || {};
        
        finalCredentials = {
            clientId: finalCredentials.clientId || dbCreds.clientId,
            clientSecret: finalCredentials.clientSecret || dbCreds.clientSecret,
            refreshToken: finalCredentials.refreshToken || dbCreds.refreshToken,
            region: finalCredentials.region || dbCreds.region,
            accountId: finalCredentials.accountId || dbCreds.accountId
        };
    } catch (e) {
        console.warn("Could not fetch zoho-mail connection from DB", e);
    }

    const region = finalCredentials.region || process.env.ZOHO_REGION || 'in';
    const accessToken = await getAccessToken(finalCredentials);
    const client = new ZohoClient(accessToken, region);

    // Get Account ID
    let accountId = finalCredentials.accountId || process.env.ZOHO_ACCOUNT_ID;
    if (!accountId) {
        const accountsRes = await client.getAccounts();
        if (!accountsRes.data || accountsRes.data.length === 0) {
            throw new Error("No Zoho accounts found.");
        }
        accountId = accountsRes.data[0].accountId;
    }

    // Get message attachments
    const messageDetailsRes = await client.getMessageAttachments(accountId as string, folderId, messageId);
    const messageDetails = messageDetailsRes.data;

    if (!messageDetails) {
        throw new Error("Message attachments not found.");
    }

    if (!messageDetails.attachments || messageDetails.attachments.length === 0) {
        return { attachments: [] };
    }

    const downloadedAttachments = [];

    // Filter to supported attachments
    let validAttachments = messageDetails.attachments.filter((att: any) => {
        const name = att.attachmentName.toLowerCase();
        return name.endsWith('.pdf') || name.endsWith('.zip');
    });

    if (attachmentId) {
        validAttachments = validAttachments.filter((att: any) => att.attachmentId === attachmentId);
    }

    for (const att of validAttachments) {
        const buffer = await client.downloadAttachment(accountId as string, folderId, messageId, att.attachmentId);
        downloadedAttachments.push({
            name: att.attachmentName,
            base64: buffer.toString('base64')
        });
    }

    return { attachments: downloadedAttachments };
}
