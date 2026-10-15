import { getAccessToken } from './oauth.js';
import type { ZohoCredentials } from './oauth.js';
import { ZohoClient } from './zohoClient.js';
import fs from 'fs';
import path from 'path';

const STATE_FILE = path.join(process.cwd(), '.last_fetch.json');

export async function fetchZohoEmails(limit: number = 10, senderFilter?: string, unreadOnly?: boolean, onlyNew?: boolean, credentials?: ZohoCredentials) {
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

    // 1. Get Account ID
    let accountId = finalCredentials.accountId || process.env.ZOHO_ACCOUNT_ID;
    if (!accountId) {
        const accountsRes = await client.getAccounts();
        if (!accountsRes.data || accountsRes.data.length === 0) {
            throw new Error("No Zoho accounts found.");
        }
        accountId = accountsRes.data[0].accountId;
    }

    // Read last fetch time
    let lastFetchTime = 0;
    if (fs.existsSync(STATE_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            lastFetchTime = data.lastFetchTime || 0;
        } catch (e) {
            console.error("Error reading state file:", e);
        }
    }

    // 2. Fetch emails from Zoho
    // If a sender is specified, we must use Zoho's Search API to find them across the entire mailbox.
    // If no sender is specified, we just fetch the recent emails.
    const fetchBatchSize = Math.max(limit, 50);
    let messagesRes;
    
    if (senderFilter) {
        messagesRes = await client.searchEmails(accountId as string, `sender:${senderFilter}`, fetchBatchSize);
    } else {
        messagesRes = await client.getRecentEmails(accountId as string, fetchBatchSize);
    }
    
    if (!messagesRes.data) return { emails: [] };

    // 3. Map and Filter
    let emails = messagesRes.data.map((msg: any) => ({
        id: msg.messageId,
        from: msg.sender !== msg.fromAddress ? `${msg.sender} <${msg.fromAddress}>` : msg.fromAddress,
        subject: msg.subject,
        date: msg.receivedTime,
        snippet: msg.summary || "No preview available",
        unread: msg.status === '0',
        folderId: msg.folderId,
        hasAttachment: msg.hasAttachment === "1" || msg.hasAttachment === "true" || msg.hasAttachment === true
    }));

    // Filter out emails that were received before the last fetch time
    if (onlyNew && lastFetchTime > 0) {
        emails = emails.filter((email: any) => parseInt(email.date) > lastFetchTime);
    }

    // We already filtered by sender via the API if it was provided, but we can do a secondary local filter just in case
    // the search API returns partial matches that the user didn't want.
    if (senderFilter) {
        const lowerSenderFilter = senderFilter.toLowerCase();
        emails = emails.filter((email: any) => email.from.toLowerCase().includes(lowerSenderFilter));
    }

    // NEW CODE TO FETCH ATTACHMENT METADATA
    for (const email of emails) {
        if (email.hasAttachment) {
            try {
                const attRes = await client.getMessageAttachments(accountId as string, email.folderId, email.id);
                if (attRes.data && attRes.data.attachments) {
                    email.attachments = attRes.data.attachments
                        .filter((a: any) => {
                            const name = a.attachmentName.toLowerCase();
                            return name.endsWith('.pdf') || name.endsWith('.zip');
                        })
                        .map((a: any) => ({
                            attachmentId: a.attachmentId,
                            name: a.attachmentName
                        }));
                } else {
                    email.attachments = [];
                }
            } catch (e) {
                console.error("Error fetching attachment info for email", email.id, e);
                email.attachments = [];
            }
        }
    }

    // Filter by unread status
    if (unreadOnly) {
        emails = emails.filter((email: any) => email.unread);
    }

    // Save the new fetch time so the next run starts from here
    // We only update lastFetchTime if onlyNew is true, meaning we're in automated tracking mode.
    if (onlyNew) {
        const newFetchTime = Date.now();
        fs.writeFileSync(STATE_FILE, JSON.stringify({ lastFetchTime: newFetchTime }));
    }

    // Finally, slice the array to respect the user's requested limit
    emails = emails.slice(0, limit);

    return { emails };
}
