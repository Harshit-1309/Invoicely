import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export interface ZohoCredentials {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    region?: string;
    accountId?: string;
}

const tokenCache = new Map<string, { token: string, expiry: number }>();

export async function getAccessToken(credentials?: ZohoCredentials): Promise<string> {
    const clientId = credentials?.clientId || process.env.ZOHO_CLIENT_ID;
    const clientSecret = credentials?.clientSecret || process.env.ZOHO_CLIENT_SECRET;
    const refreshToken = credentials?.refreshToken || process.env.ZOHO_REFRESH_TOKEN;
    const region = credentials?.region || process.env.ZOHO_REGION || 'in';

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("Missing Zoho OAuth credentials. Please provide them or set them in .env");
    }

    const cached = tokenCache.get(refreshToken);
    if (cached && Date.now() < cached.expiry) {
        return cached.token;
    }

    const url = `https://accounts.zoho.${region}/oauth/v2/token`;
    const params = new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token'
    });

    try {
        const response = await axios.post(url, params.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (response.data.access_token) {
            const token = response.data.access_token;
            // expires_in is in seconds. Cache for 1 minute less than expiry.
            const expiry = Date.now() + (response.data.expires_in * 1000) - 60000;
            tokenCache.set(refreshToken, { token, expiry });
            return token;
        } else {
            throw new Error(`Failed to refresh token: ${JSON.stringify(response.data)}`);
        }
    } catch (error: any) {
        throw new Error(`OAuth Error: ${JSON.stringify(error.response?.data) || error.message}`);
    }
}

