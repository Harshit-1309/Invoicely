import { getAccessToken } from './src/oauth.js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        const token = await getAccessToken();
        console.log("Token acquired.");
        
        const region = process.env.ZOHO_REGION || 'in';
        const url = `https://books.zoho.${region}/api/v3/organizations`;
        
        const res = await axios.get(url, {
            headers: {
                Authorization: `Zoho-oauthtoken ${token}`
            }
        });
        
        console.log(JSON.stringify(res.data, null, 2));
    } catch (err: any) {
        console.error("Failed to fetch from Zoho Books:", err.response?.data || err.message);
    }
}

test();
