import axios from 'axios';

export class ZohoClient {
    private accessToken: string;
    private baseUrl: string;

    constructor(accessToken: string, region: string) {
        this.accessToken = accessToken;
        this.baseUrl = `https://mail.zoho.${region}/api/accounts`;
    }

    private async request(endpoint: string, method: string = 'GET', responseType: 'json' | 'arraybuffer' = 'json') {
        const response = await axios({
            method,
            url: `${this.baseUrl}${endpoint}`,
            headers: {
                'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
                'Accept': responseType === 'json' ? 'application/json' : 'application/octet-stream'
            },
            responseType
        });
        return response.data;
    }

    async getAccounts() {
        return this.request('');
    }

    async getRecentEmails(accountId: string, limit: number = 10) {
        return this.request(`/${accountId}/messages/view?limit=${limit}`);
    }

    async searchEmails(accountId: string, searchKey: string, limit: number = 10) {
        return this.request(`/${accountId}/messages/search?searchKey=${encodeURIComponent(searchKey)}&limit=${limit}`);
    }

    async getMessageDetails(accountId: string, folderId: string, messageId: string) {
        return this.request(`/${accountId}/folders/${folderId}/messages/${messageId}/details`);
    }

    async getMessageAttachments(accountId: string, folderId: string, messageId: string) {
        return this.request(`/${accountId}/folders/${folderId}/messages/${messageId}/attachmentinfo`);
    }

    async downloadAttachment(accountId: string, folderId: string, messageId: string, attachmentId: string): Promise<Buffer> {
        const data = await this.request(`/${accountId}/folders/${folderId}/messages/${messageId}/attachments/${attachmentId}`, 'GET', 'arraybuffer');
        return Buffer.from(data);
    }
}
