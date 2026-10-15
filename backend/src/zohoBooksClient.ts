import axios from 'axios';
import { getAccessToken } from './oauth.js';

export class ZohoBooksClient {
    private async request(endpoint: string, method: string = 'GET', data?: any) {
        const { Connection } = await import('./models/Connection.js');
        const zohoBooksConn = await Connection.findOne({ connectionId: 'zoho-books' });
        const creds = zohoBooksConn?.credentials || {};
        
        const token = await getAccessToken(creds);
        const orgId = creds.organizationId || process.env.ZOHO_ORGANIZATION_ID;
        const region = creds.region || process.env.ZOHO_REGION || 'in';
        
        const baseUrl = `https://www.zohoapis.${region}/books/v3`;
        let url = `${baseUrl}${endpoint}`;
        if (orgId) {
            url += url.includes('?') ? `&organization_id=${orgId}` : `?organization_id=${orgId}`;
        }

        const response = await axios({
            method,
            url,
            data,
            headers: {
                'Authorization': `Zoho-oauthtoken ${token}`,
                'Accept': 'application/json'
            }
        });
        return response.data;
    }
    async getContacts(type: string = 'vendor') {
        return this.request(`/contacts?contact_type=${type}`);
    }

    async getContact(contactId: string) {
        return this.request(`/contacts/${contactId}`);
    }

    async getBills() {
        return this.request('/bills');
    }

    async getBill(billId: string) {
        return this.request(`/bills/${billId}`);
    }

    async getChartOfAccounts() {
        return this.request('/chartofaccounts');
    }

    async getPurchaseOrders() {
        return this.request('/purchaseorders');
    }

    async getPurchaseOrder(poId: string) {
        return this.request(`/purchaseorders/${poId}`);
    }

    async deleteBill(billId: string) {
        return this.request(`/bills/${billId}`, 'DELETE');
    }

    async deleteContact(contactId: string) {
        return this.request(`/contacts/${contactId}`, 'DELETE');
    }
}
