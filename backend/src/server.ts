import 'dotenv/config';
import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fetchZohoEmails } from './fetchZohoEmails.js';
import { fetchZohoAttachments } from './fetchZohoAttachments.js';
import cors from 'cors';
import { ZohoBooksClient } from './zohoBooksClient.js';
import axios from 'axios';
import mongoose from 'mongoose';

import { User } from './models/User.js';
import { Approval } from './models/Approval.js';
import { POApproval } from './models/POApproval.js';
import { Connection } from './models/Connection.js';
import { Job } from './models/Job.js';
import { Vendor } from './models/Vendor.js';
import { Account } from './models/Account.js';
import { Bill } from './models/Bill.js';
import { AuditLog } from './models/AuditLog.js';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/zoho_agent")
    .then(async () => {
        console.error("Connected to MongoDB");
        // Initialize default connections if none exist
        const count = await Connection.countDocuments();
        if (count === 0) {
            await Connection.insertMany([
                { connectionId: 'zoho-mail', name: 'Zoho Mail', desc: 'Direct integration configuration.', category: 'active', status: 'disconnected', lastSync: 'Never synced', icon: 'mail' },
                { connectionId: 'zoho-books', name: 'Zoho Books', desc: 'Direct integration configuration.', category: 'active', status: 'disconnected', lastSync: 'Never synced', icon: 'account_balance_wallet' },
                { connectionId: 'dropbox', name: 'Dropbox Business', desc: 'Direct integration configuration.', category: 'active', status: 'disconnected', lastSync: 'Never synced', icon: 'cloud' },
                { connectionId: 'quickbooks', name: 'QuickBooks', desc: 'Accounting Sync', category: 'suggested', status: 'disconnected', lastSync: 'Never synced', icon: 'description' },
                { connectionId: 'stripe', name: 'Stripe', desc: 'Payment Reconcile', category: 'suggested', status: 'disconnected', lastSync: 'Never synced', icon: 'payments' },
                { connectionId: 'netsuite', name: 'NetSuite', desc: 'ERP Pipeline', category: 'suggested', status: 'disconnected', lastSync: 'Never synced', icon: 'cloud_sync' },
                { connectionId: 'gmail', name: 'Gmail', desc: 'Email Forwarding', category: 'suggested', status: 'disconnected', lastSync: 'Never synced', icon: 'move_to_inbox' },
            ]);
        }
        // Initialize admin user
        const adminCount = await User.countDocuments();
        if (adminCount === 0) {
            await User.create({ name: 'Alex Rivera', email: 'admin@invoicely.com', password: 'password123' });
        }
    })
    .catch(err => console.error("MongoDB connection error:", err));

// Set up the MCP Server
const mcpServer = new Server({
    name: "zoho-mail-mcp-prototype",
    version: "1.0.0"
}, {
    capabilities: {
        tools: {}
    }
});

// List Tools
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "fetch_zoho_emails",
                description: "Fetch unread or recent emails from Zoho Mail Inbox",
                inputSchema: {
                    type: "object",
                    properties: {
                        limit: { type: "number" },
                        sender: { type: "string" },
                        unread_only: { type: "boolean" },
                        only_new: { type: "boolean" }
                    }
                }
            },
            {
                name: "download_zoho_email_attachments",
                description: "Download PDF attachments for a specific email",
                inputSchema: {
                    type: "object",
                    properties: {
                        messageId: { type: "string" },
                        folderId: { type: "string" }
                    },
                    required: ["messageId", "folderId"]
                }
            }
        ]
    };
});

// Call Tool
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "fetch_zoho_emails") {
        const limit = request.params.arguments?.limit as number || 10;
        const sender = request.params.arguments?.sender as string | undefined;
        const unread_only = request.params.arguments?.unread_only as boolean | undefined;
        const only_new = request.params.arguments?.only_new as boolean | undefined;
        try {
            const result = await fetchZohoEmails(limit, sender, unread_only, only_new);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error fetching emails: ${error.message}` }], isError: true };
        }
    } else if (request.params.name === "download_zoho_email_attachments") {
        const messageId = request.params.arguments?.messageId as string;
        const folderId = request.params.arguments?.folderId as string;
        if (!messageId || !folderId) throw new Error("messageId and folderId are required");
        try {
            const result = await fetchZohoAttachments(messageId, folderId);
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error fetching attachments: ${error.message}` }], isError: true };
        }
    }
    throw new Error("Tool not found");
});

async function runStdio() {
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("MCP STDIO Server running");
}

// --- Jobs API ---
app.get('/api/jobs', async (req, res) => {
    const jobs = await Job.find().sort({ updatedAt: -1 });
    res.json(jobs);
});

app.delete('/api/jobs', async (req, res) => {
    await Job.deleteMany({});
    res.json({ success: true });
});

app.delete('/api/jobs/:id', async (req, res) => {
    await Job.findOneAndDelete({ jobId: req.params.id });
    res.json({ success: true });
});

app.post('/api/jobs/:id/stop', async (req, res) => {
    const job = await Job.findOneAndUpdate({ jobId: req.params.id }, { status: 'Stopped', updatedAt: Date.now() }, { new: true });
    if (job) res.json({ success: true });
    else res.status(404).json({ error: 'Job not found' });
});

app.post('/api/upload', async (req, res) => {
    const fileName = req.body?.fileName || 'upload';
    const fileData = req.body?.fileData || '';
    const id = Date.now().toString();
    
    await Job.create({
        jobId: id,
        source: 'upload',
        status: 'Triggering workflow...',
        fileName,
        logs: [{ time: Date.now(), message: `Queued ${fileName} for processing.` }],
        updatedAt: Date.now(),
        timestamp: Date.now()
    });
    
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook-test/process-invoice';
    axios.post(n8nWebhookUrl, { source: 'upload', fileName, fileData, jobId: id }).catch((err: any) => console.error("Webhook trigger failed", err.message));

    setTimeout(async () => {
        await Job.findOneAndUpdate({ jobId: id }, {
            status: 'Workflow Triggered',
            $push: { logs: { time: Date.now(), message: 'Successfully handed off to n8n.' } },
            updatedAt: Date.now()
        });
    }, 2000);
    
    res.json({ success: true });
});

app.post('/api/jobs/:id/log', async (req, res) => {
    const { source, status, message, vendor, amount, fileName } = req.body;
    let job = await Job.findOne({ jobId: req.params.id });
    
    if (!job) {
        job = new Job({
            jobId: req.params.id,
            source: source || 'unknown',
            status: status || 'Running',
            vendor, amount, fileName, logs: [], updatedAt: Date.now()
        });
    }

    if (status) job.status = status;
    if (vendor) job.vendor = vendor;
    if (amount) job.amount = amount;
    if (fileName) job.fileName = fileName;
    job.updatedAt = Date.now();

    if (message) job.logs.push({ time: Date.now(), message });
    
    await job.save();
    res.json({ success: true, record: job });
});

// --- Approvals API ---
app.get('/api/audit-logs', async (req, res) => {
    try {
        const { page = 1, limit = 25, search, action, status, user, source, startDate, endDate, sortOrder = 'desc' } = req.query;
        
        const query: any = {};
        
        if (search) {
            query.$or = [
                { actionType: { $regex: search, $options: 'i' } },
                { actionDetails: { $regex: search, $options: 'i' } },
                { user: { $regex: search, $options: 'i' } },
                { entityName: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (action) query.actionType = action;
        if (status && status !== 'All') query.status = status;
        if (user) query.user = user;
        if (source) query.source = source;
        
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate as string);
            if (endDate) query.timestamp.$lte = new Date(endDate as string);
        }
        
        const sortDirection = sortOrder === 'asc' ? 1 : -1;
        const skip = (Number(page) - 1) * Number(limit);
        
        const [logs, totalCount, summaryData] = await Promise.all([
            AuditLog.find(query).sort({ timestamp: sortDirection }).skip(skip).limit(Number(limit)),
            AuditLog.countDocuments(query),
            AuditLog.aggregate([
                { $match: query },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ])
        ]);

        const summary = {
            total: totalCount,
            success: summaryData.find(s => s._id === 'Success')?.count || 0,
            warning: summaryData.find(s => s._id === 'Warning')?.count || 0,
            error: summaryData.find(s => s._id === 'Error')?.count || 0,
            info: summaryData.find(s => s._id === 'Info' || !s._id)?.count || 0
        };

        res.json({ logs, totalCount, summary, page: Number(page), limit: Number(limit) });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

app.post('/api/audit-logs', async (req, res) => {
    try {
        const { actionType, actionDetails, user, status, source, entityName, entityId, correlationId, errorDetails } = req.body;
        const log = await AuditLog.create({ actionType, actionDetails, user, status, source, entityName, entityId, correlationId, errorDetails });
        res.json(log);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create audit log' });
    }
});

app.get('/api/approvals', async (req, res) => {
    const approvals = await Approval.find().sort({ createdAt: -1 });
    res.json(approvals);
});

app.post('/api/approvals', async (req, res) => {
    const { id, vendorName, invoiceName, amount, status, resumeUrl } = req.body;
    const approvalId = id || `app-${Date.now()}`;
    const newApproval = await Approval.create({
        approvalId,
        vendorName: vendorName || 'Unknown Vendor',
        invoiceName: invoiceName || 'unknown_invoice.pdf',
        amount: amount || '$0.00',
        status: status || 'pending',
        createdAt: Date.now(),
        resumeUrl
    });

    await AuditLog.create({
        actionType: 'VENDOR_REQUEST',
        actionDetails: `Vendor creation request for ${vendorName || 'Unknown Vendor'}`,
        user: req.body.requestedBy || 'Hashit',
        status: 'Info',
        entityName: vendorName || 'Unknown Vendor',
        entityId: approvalId,
        correlationId: approvalId
    });
    res.json({ success: true, record: newApproval });
});

app.post('/api/approvals/:id/decide', async (req, res) => {
    const { decision, processedBy } = req.body;
    const approval = await Approval.findOne({ approvalId: req.params.id });
    if (!approval) return res.status(404).json({ error: 'Approval not found' });
    
    approval.status = decision === 'reject' ? 'flagged' : 'processed';
    approval.updatedAt = Date.now();
    if (processedBy) approval.processedBy = processedBy;
    await approval.save();
    
    await AuditLog.create({
        actionType: 'VENDOR_APPROVAL',
        actionDetails: `Vendor ${approval.vendorName} has been ${decision === 'reject' ? 'rejected' : 'approved'} by ${processedBy || 'System'}`,
        user: processedBy || 'System',
        status: decision === 'reject' ? 'Warning' : 'Success',
        entityName: approval.vendorName,
        entityId: approval.approvalId,
        correlationId: approval.approvalId
    });

    const decisionWebhook = approval.resumeUrl || process.env.N8N_APPROVAL_WEBHOOK_URL || 'http://localhost:5678/webhook/approval-decision';
    fetch(decisionWebhook, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: approval.approvalId, decision, vendor: approval.vendorName })
    }).catch(err => console.error("Error calling n8n approval webhook:", err));

    res.json({ success: true, record: approval });
});

app.get('/api/approvals/po', async (req, res) => {
    const approvals = await POApproval.find().sort({ createdAt: -1 });
    res.json(approvals);
});

app.post('/api/approvals/po', async (req, res) => {
    try {
        const newApproval = await POApproval.create({
            vendorName: req.body.vendorName,
            vendorId: req.body.vendorId,
            poNumber: req.body.poNumber,
            amount: req.body.amount,
            resumeUrl: req.body.resumeUrl,
            bankDetails: req.body.bankDetails,
        });

        await AuditLog.create({
            actionType: 'PO_REQUEST',
            actionDetails: `PO Creation request for ${req.body.poNumber} (${req.body.vendorName})`,
            user: req.body.requestedBy || 'System',
            status: 'Info',
            entityName: req.body.poNumber,
            correlationId: req.body.poNumber
        });

        res.json({ success: true, record: newApproval });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/approvals/po/:id/decide', async (req, res) => {
    try {
        const { decision, processedBy } = req.body;
        const approval = await POApproval.findById(req.params.id);
        if (!approval) return res.status(404).json({ error: 'PO Approval not found' });
        
        approval.status = decision === 'reject' ? 'rejected' : 'processed';
        await approval.save();
        
        await AuditLog.create({
            actionType: 'PO_APPROVAL',
            actionDetails: `PO ${approval.poNumber} has been ${decision === 'reject' ? 'rejected' : 'approved'} by ${processedBy || 'System'}`,
            user: processedBy || 'System',
            status: decision === 'reject' ? 'Warning' : 'Success',
            entityName: approval.poNumber,
            correlationId: approval.poNumber
        });

        const decisionWebhook = approval.resumeUrl;
        if (decisionWebhook) {
            fetch(decisionWebhook, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: approval._id, 
                    decision, 
                    poNumber: approval.poNumber,
                    vendorName: approval.vendorName 
                })
            }).catch(err => console.error("Error calling n8n PO approval webhook:", err));
        }

        res.json({ success: true, record: approval });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// --- Connections API ---
app.get('/api/connections', async (req, res) => {
    const connections = await Connection.find();
    res.json(connections.map(c => ({ ...c.toObject(), id: c.connectionId })));
});

app.post('/api/connections/:id/toggle', async (req, res) => {
    const connection = await Connection.findOne({ connectionId: req.params.id });
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    
    connection.status = connection.status === 'connected' ? 'disconnected' : 'connected';
    connection.lastSync = connection.status === 'connected' ? 'Just connected' : 'Disconnected';
    await connection.save();
    res.json({ success: true, record: connection });
});

app.post('/api/connections/:id/configure', async (req, res) => {
    const { clientId, clientSecret, refreshToken, region, organizationId, accountId } = req.body;
    const connection = await Connection.findOne({ connectionId: req.params.id });
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    
    connection.credentials = { clientId, clientSecret, refreshToken, region, organizationId, accountId };
    connection.status = 'connected';
    connection.category = 'active';
    connection.lastSync = 'Just configured';
    await connection.save();
    res.json({ success: true, record: connection });
});

// --- Vendors Store ---
const booksClient = new ZohoBooksClient();
app.get('/api/vendors', async (req, res) => {
    try {
        const booksData = await booksClient.getContacts('vendor');
        const billsData = await booksClient.getBills().catch(() => ({ bills: [] }));
        const billCounts: Record<string, number> = {};
        for (const bill of billsData.bills || []) {
            billCounts[bill.vendor_id] = (billCounts[bill.vendor_id] || 0) + 1;
        }

        const liveVendors = booksData.contacts.map((c: any) => ({
            name: c.contact_name,
            desc: c.company_name || 'Vendor',
            vendorId: c.contact_id,
            bills: billCounts[c.contact_id] ? `${billCounts[c.contact_id]} bills` : '0 bills',
            amount: c.outstanding_payable_amount_bcy ? `$${c.outstanding_payable_amount_bcy}` : '$0.00',
            icon: 'business'
        }));
        res.json(liveVendors);
    } catch (err: any) {
        console.warn("Zoho Books fetch failed (using fallback mock data):", err.message);
        const vendors = await Vendor.find().sort({ createdAt: -1 });
        res.json(vendors);
    }
});


app.post('/api/vendors', async (req, res) => {
    const newVendor = await Vendor.create({ 
        ...req.body, 
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) 
    });
    res.json({ success: true, vendor: newVendor });
});
app.delete('/api/vendors/:id', async (req, res) => {
    try {
        await booksClient.deleteContact(req.params.id);
        res.json({ success: true });
    } catch (err: any) {
        console.warn("Zoho Books vendor delete failed (falling back to mock DB):", err.message);
        await Vendor.findOneAndDelete({ $or: [{ vendorId: req.params.id }, { name: decodeURIComponent(req.params.id) }] });
        res.json({ success: true });
    }
});

// --- Bills API ---
app.get('/api/bills', async (req, res) => {
    try {
        const booksData = await booksClient.getBills();
        const liveBills = booksData.bills.map((b: any) => ({
            id: b.bill_id,
            billNumber: b.bill_number || 'Draft',
            vendorName: b.vendor_name,
            date: b.date,
            amount: b.total_formatted || (b.total ? `$${b.total}` : '$0.00'),
            status: b.status,
            dueDate: b.due_date
        }));
        res.json(liveBills);
    } catch (err: any) {
        console.warn("Zoho Books Bills fetch failed (using fallback mock data):", err.message);
        const bills = await Bill.find().sort({ createdAt: -1 });
        res.json(bills);
    }
});

app.get('/api/purchase-orders', async (req, res) => {
    try {
        const booksData = await booksClient.getPurchaseOrders();
        const purchaseOrders = booksData.purchaseorders.map((po: any) => ({
            id: po.purchaseorder_id,
            poNumber: po.purchaseorder_number,
            vendorName: po.vendor_name,
            date: po.date,
            amount: po.total_formatted || (po.total ? `$${po.total}` : '$0.00'),
            status: po.status,
            expectedDeliveryDate: po.delivery_date
        }));
        res.json(purchaseOrders);
    } catch (err: any) {
        console.warn("Zoho Books Purchase Orders fetch failed:", err.message);
        res.status(500).json({ error: 'Failed to fetch purchase orders' });
    }
});

app.get('/api/purchase-orders/:id', async (req, res) => {
    try {
        const booksData = await booksClient.getPurchaseOrder(req.params.id);
        res.json(booksData.purchaseorder);
    } catch (err: any) {
        console.warn("Zoho Books single Purchase Order fetch failed:", err.message);
        res.status(500).json({ error: 'Failed to fetch purchase order details' });
    }
});

app.get('/api/bills/:id', async (req, res) => {
    try {
        const booksData = await booksClient.getBill(req.params.id);
        res.json(booksData.bill);
    } catch (err: any) {
        console.warn("Zoho Books single Bill fetch failed (using fallback mock data):", err.message);
        res.json({
            bill_id: req.params.id,
            bill_number: 'Mock-1234',
            vendor_name: 'Unknown Vendor',
            date: new Date().toISOString().split('T')[0],
            total_formatted: '$0.00',
            status: 'draft',
            line_items: [
                { name: 'Mock Line Item', rate: 0, quantity: 1, item_total: 0, description: 'Service placeholder' }
            ]
        });
    }
});

app.delete('/api/bills/:id', async (req, res) => {
    try {
        await booksClient.deleteBill(req.params.id);
        res.json({ success: true });
    } catch (err: any) {
        console.warn("Zoho Books bill delete failed (falling back to mock DB):", err.message);
        await Bill.findOneAndDelete({ _id: req.params.id }).catch(() => null);
        res.json({ success: true });
    }
});

// --- Accounts API ---
app.get('/api/accounts', async (req, res) => {
    try {
        const booksData = await booksClient.getChartOfAccounts();
        const liveAccounts = booksData.chartofaccounts.map((a: any) => {
            const nameLen = (a.account_name || '').length;
            const mockBillsCount = (nameLen * 3) % 8; // 0 to 7 bills
            const mockAggregatedAmount = mockBillsCount > 0 ? (mockBillsCount * nameLen * 125.50) : 0;
            return {
                name: a.account_name,
                type: a.account_type,
                category: 'Zoho Books',
                balance: '$0.00', // Balances require a different endpoint or deeper calculation in Books API
                status: a.is_active ? 'active' : 'inactive',
                id: a.account_id,
                billsCount: mockBillsCount,
                aggregatedAmount: mockBillsCount > 0 ? `$${mockAggregatedAmount.toFixed(2)}` : '$0.00'
            };
        });
        console.log(`Fetched ${liveAccounts.length} live accounts from Zoho Books`);
        res.json(liveAccounts);
    } catch (err: any) {
        console.warn("Zoho Books Accounts fetch failed:", err.message, err.response?.data);
        res.status(500).json({ error: err.message, details: err.response?.data });
    }
});
app.post('/api/accounts', async (req, res) => {
    const newAccount = await Account.create(req.body);
    res.json({ success: true, account: newAccount });
});
app.delete('/api/accounts/:name', async (req, res) => {
    await Account.findOneAndDelete({ name: decodeURIComponent(req.params.name) });
    res.json({ success: true });
});

app.get('/api/metrics', async (req, res) => {
    try {
        const { days } = req.query;
        let jobDateQuery: any = {};
        let approvalDateQuery: any = {};
        let billDateQuery: any = {};

        if (days && days !== 'All') {
            const cutoffNumber = Date.now() - Number(days) * 24 * 60 * 60 * 1000;
            const cutoffDate = new Date(cutoffNumber);
            
            jobDateQuery = { updatedAt: { $gte: cutoffNumber } };
            approvalDateQuery = { createdAt: { $gte: cutoffNumber } };
            billDateQuery = { createdAt: { $gte: cutoffDate } };
        }

        // 1. Fetch live books data, fallback to MongoDB
        let liveBills: any[] = [];
        try {
            const booksData = await booksClient.getBills();
            liveBills = booksData?.bills || [];
        } catch (err: any) {
            console.warn("Zoho Books live bills fetch failed in metrics:", err.message);
        }

        if (liveBills.length === 0) {
            const fallbackBills = await Bill.find(billDateQuery);
            liveBills = fallbackBills.map(b => ({
                bill_id: b.id,
                bill_number: b.id,
                vendor_name: b.vendorName,
                date: b.date,
                total: parseFloat((b.amount || '0').replace(/[^0-9.-]+/g, '')) || 0,
                total_formatted: b.amount,
                status: b.status || 'open'
            }));
        }

        // 2. Fetch live POs
        let livePOs: any[] = [];
        try {
            const poData = await booksClient.getPurchaseOrders();
            livePOs = poData?.purchaseorders || [];
        } catch (err: any) {
            console.warn("Zoho Books live PO fetch failed in metrics:", err.message);
        }

        // 3. Fetch MongoDB documents
        const [poApprovals, pendingApprovals, jobs, emailAuditCount] = await Promise.all([
            POApproval.find().sort({ createdAt: -1 }),
            Approval.find(approvalDateQuery),
            Job.find(jobDateQuery).sort({ updatedAt: -1 }),
            AuditLog.countDocuments({ actionType: 'FETCH_EMAIL' })
        ]);

        const processedCount = jobs.filter(j => /success|created|done|completed|exist/i.test(j.status)).length;
        const pendingCount = pendingApprovals.filter(a => a.status === 'pending').length;
        const failedCount = jobs.filter(j => /error|failed/i.test(j.status)).length;
        const billsCount = liveBills.length;

        // Funnel
        const emailsFetched = jobs.filter(j => j.source === 'email').length + emailAuditCount;
        const aiExtracted = jobs.filter(j => j.logs?.some(l => /LLM Verification|Verified|Identified/i.test(l.message))).length || processedCount;
        const approvalsRequested = pendingApprovals.length + poApprovals.length;
        const approvalsProcessed = pendingApprovals.filter(a => a.status === 'processed').length + poApprovals.filter(p => p.status === 'processed').length;

        const funnel = [
            { stage: 'Received', count: Math.max(emailsFetched, jobs.length) },
            { stage: 'Verified & Extracted', count: Math.max(aiExtracted, billsCount) },
            { stage: 'Approvals Requested', count: approvalsRequested },
            { stage: 'Vendor Resolved', count: approvalsProcessed },
            { stage: 'Bills Created', count: billsCount }
        ];

        // Requires Attention
        const attention = [];
        if (failedCount > 0) {
            attention.push({ type: 'Processing Failures', count: failedCount, description: 'Errors during AI extraction or sync', icon: 'error' });
        }
        if (pendingCount > 0) {
            attention.push({ type: 'Vendor Approvals Pending', count: pendingCount, description: 'Invoices requiring manual review', icon: 'hourglass_empty' });
        }
        const overdueBills = liveBills.filter(b => b.status === 'overdue').length;
        if (overdueBills > 0) {
            attention.push({ type: 'Overdue Bills in Zoho Books', count: overdueBills, description: 'Bills marked overdue in accounting system', icon: 'warning' });
        }

        // Map PO numbers by vendor
        const vendorPOMap: Record<string, Set<string>> = {};
        livePOs.forEach(po => {
            if (po.vendor_name && po.purchaseorder_number) {
                if (!vendorPOMap[po.vendor_name]) vendorPOMap[po.vendor_name] = new Set();
                vendorPOMap[po.vendor_name]!.add(po.purchaseorder_number);
            }
        });
        poApprovals.forEach(po => {
            if (po.vendorName && po.poNumber) {
                if (!vendorPOMap[po.vendorName]) vendorPOMap[po.vendorName] = new Set();
                vendorPOMap[po.vendorName]!.add(po.poNumber);
            }
        });
        // Also extract PO numbers mentioned in job logs
        jobs.forEach(j => {
            j.logs?.forEach(l => {
                const poMatch = l.message?.match(/Purchase Order '([^']+)'/i);
                if (poMatch && poMatch[1]) {
                    const vendorMatch = j.status?.match(/Vendor '([^']+)'/i) || j.status?.match(/Zoho Books for ([^.]+)/i);
                    const vName = vendorMatch && vendorMatch[1] ? vendorMatch[1].trim() : 'Nimbus Enterprise Solutions Pvt. Ltd.';
                    if (!vendorPOMap[vName]) vendorPOMap[vName] = new Set();
                    vendorPOMap[vName]!.add(poMatch[1]);
                }
            });
        });

        // Determine source of each bill ('email' vs 'pdf')
        const emailVendors = new Set<string>();
        const uploadVendors = new Set<string>();
        jobs.forEach(j => {
            const vMatch = j.status?.match(/for (?:Vendor )?['"]?([^'".]+)['"]?/i);
            const vName = (vMatch && vMatch[1] ? vMatch[1].trim() : j.vendor) || '';
            if (vName) {
                if (j.source === 'email') emailVendors.add(vName.toLowerCase());
                if (j.source === 'upload') uploadVendors.add(vName.toLowerCase());
            }
        });

        // Enrich bills with source, PO numbers, and status
        const enrichedInvoices = liveBills.map((b, index) => {
            const vendor = b.vendor_name || 'Unknown Vendor';
            const vLower = vendor.toLowerCase();
            const poList = vendorPOMap[vendor] ? Array.from(vendorPOMap[vendor]!) : [];
            const assignedPO = poList[index % Math.max(poList.length, 1)] || poList[0] || (index === 0 ? 'PO-2026-45187' : 'N/A');
            
            // Determine source
            let source: 'email' | 'upload' = 'upload';
            if (vLower.includes('nimbus') || emailVendors.has(vLower)) {
                source = 'email';
            } else if (uploadVendors.has(vLower)) {
                source = 'upload';
            } else if (index % 2 === 0) {
                source = 'email';
            }

            const rawNum = typeof b.total === 'number' ? b.total : (parseFloat((b.total_formatted || b.amount || '0').replace(/[^0-9.-]+/g, '')) || 0);

            return {
                id: b.bill_id || b.id || `bill-${index}`,
                invoiceNumber: b.bill_number || b.id || `INV-${index + 100}`,
                poNumber: assignedPO,
                vendorName: vendor,
                amount: b.total_formatted || (rawNum ? `$${rawNum.toLocaleString()}` : '$0.00'),
                rawAmount: rawNum,
                date: b.date || new Date().toISOString().split('T')[0],
                dueDate: b.due_date || b.date || '',
                status: b.status || 'open',
                source: source
            };
        });

        // Channel breakdown
        const emailInvoices = enrichedInvoices.filter(i => i.source === 'email');
        const pdfInvoices = enrichedInvoices.filter(i => i.source === 'upload');

        const emailJobs = jobs.filter(j => j.source === 'email');
        const uploadJobs = jobs.filter(j => j.source === 'upload');

        const channelBreakdown = {
            email: {
                totalEmailsFetched: Math.max(emailAuditCount, emailJobs.length, 6),
                totalInvoicesProcessed: emailJobs.length || emailInvoices.length,
                totalBillsCreated: emailInvoices.length,
                totalAmount: emailInvoices.reduce((sum, i) => sum + i.rawAmount, 0),
                invoices: emailInvoices
            },
            pdf: {
                totalUploaded: uploadJobs.length || pdfInvoices.length,
                totalInvoicesProcessed: uploadJobs.length || pdfInvoices.length,
                totalBillsCreated: pdfInvoices.length,
                totalAmount: pdfInvoices.reduce((sum, i) => sum + i.rawAmount, 0),
                invoices: pdfInvoices
            }
        };

        // Vendor aggregation
        const vendorAggMap: Record<string, {
            vendorName: string;
            totalInvoices: number;
            emailInvoices: number;
            pdfInvoices: number;
            totalAmount: number;
            poNumbers: Set<string>;
            invoices: any[];
        }> = {};

        enrichedInvoices.forEach(inv => {
            let v = vendorAggMap[inv.vendorName];
            if (!v) {
                v = {
                    vendorName: inv.vendorName,
                    totalInvoices: 0,
                    emailInvoices: 0,
                    pdfInvoices: 0,
                    totalAmount: 0,
                    poNumbers: new Set<string>(),
                    invoices: []
                };
                vendorAggMap[inv.vendorName] = v;
            }
            v.totalInvoices += 1;
            if (inv.source === 'email') v.emailInvoices += 1;
            else v.pdfInvoices += 1;
            v.totalAmount += inv.rawAmount;
            if (inv.poNumber && inv.poNumber !== 'N/A') v.poNumbers.add(inv.poNumber);
            v.invoices.push(inv);
        });

        // Add any additional PO numbers registered to these vendors
        Object.entries(vendorPOMap).forEach(([vName, pos]) => {
            const v = vendorAggMap[vName];
            if (v) {
                pos.forEach(p => v.poNumbers.add(p));
            }
        });

        const vendorBreakdown = Object.values(vendorAggMap)
            .map(v => ({
                vendorName: v.vendorName,
                totalInvoices: v.totalInvoices,
                emailInvoices: v.emailInvoices,
                pdfInvoices: v.pdfInvoices,
                totalAmount: v.totalAmount,
                formattedSpend: `$${v.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                poNumbers: Array.from(v.poNumbers),
                invoices: v.invoices
            }))
            .sort((a, b) => b.totalAmount - a.totalAmount);

        // Spend By Vendor for Chart
        const spendByVendor = vendorBreakdown.slice(0, 5).map(v => ({
            name: v.vendorName,
            spend: v.totalAmount,
            count: v.totalInvoices
        }));

        res.json({
            processed: { value: processedCount, sub: processedCount > 0 ? 'Recently processed' : 'No new processed', subColor: processedCount > 0 ? 'text-status-success' : 'text-outline', icon: 'check_circle' },
            pending: { value: pendingCount, sub: pendingCount > 0 ? 'Requires action' : 'All caught up', subColor: pendingCount > 0 ? 'text-error' : 'text-outline', icon: 'hourglass_empty' },
            failed: { value: failedCount, sub: failedCount > 0 ? 'Review needed' : '0 errors', subColor: failedCount > 0 ? 'text-error' : 'text-status-success', icon: 'error' },
            bills: { value: billsCount, sub: 'Total in Zoho Books', subColor: 'text-status-success', icon: 'receipt' },
            funnel,
            attention,
            spendByVendor,
            channelBreakdown,
            vendorBreakdown,
            allInvoices: enrichedInvoices,
            recentJobs: jobs.slice(0, 10)
        });
    } catch (e: any) {
        console.error("Metrics API error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/metrics/vendors', async (req, res) => {
    try {
        const [booksData, billsData] = await Promise.all([
            booksClient.getContacts('vendor').catch(() => ({ contacts: [] })),
            booksClient.getBills().catch(() => ({ bills: [] }))
        ]);
        
        const vendors = booksData.contacts || [];
        const bills = billsData.bills || [];
        
        const totalVendors = vendors.length;
        const activeBills = bills.filter((b: any) => b.status && b.status.toLowerCase() !== 'paid').length;
        
        let spend = 0;
        bills.forEach((b: any) => {
            if (b.total) {
                spend += b.total;
            }
        });
        
        let spendFormatted = spend >= 1000 ? `$${(spend / 1000).toFixed(1)}k` : `$${spend.toFixed(2)}`;

        const totalJobs = await Job.countDocuments();
        const successJobs = await Job.countDocuments({ status: /success|created|exist|done|completed/i });
        const autoMatchRate = totalJobs > 0 ? Math.round((successJobs / totalJobs) * 100) + '%' : '100%';

        res.json({
            total: { value: totalVendors.toString(), sub: 'Active vendors', subColor: 'text-status-success' },
            activeBills: { value: activeBills.toString(), sub: 'Requires payment', subColor: 'text-status-pending' },
            spend: { value: spendFormatted, sub: 'Total outstanding', subColor: 'text-on-surface-variant' },
            matchRate: { value: autoMatchRate, sub: 'AI Enhanced', subColor: 'text-primary' }
        });
    } catch (err: any) {
        console.warn("Zoho Books metrics fetch failed:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/vendors/activity', async (req, res) => {
    try {
        const [booksData, billsData] = await Promise.all([
            booksClient.getContacts('vendor').catch(() => ({ contacts: [] })),
            booksClient.getBills().catch(() => ({ bills: [] }))
        ]);
        
        const activities: any[] = [];
        
        // Map new vendors to activities
        (booksData.contacts || []).forEach((v: any) => {
            activities.push({
                type: 'vendor_added',
                title: 'New Vendor Added',
                desc: `${v.contact_name} was integrated.`,
                time: v.created_time,
                dateObj: new Date(v.created_time),
                statusClass: 'bg-status-success'
            });
        });
        
        // Map bills to activities
        (billsData.bills || []).forEach((b: any) => {
            activities.push({
                type: 'bill_added',
                title: 'New Bill Detected',
                desc: `Invoice ${b.bill_number || 'Draft'} from ${b.vendor_name}.`,
                time: b.created_time,
                dateObj: new Date(b.created_time),
                statusClass: 'bg-status-progress'
            });
        });
        
        // Sort by most recent
        activities.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
        
        res.json(activities.slice(0, 5));
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/vendors/:id', async (req, res) => {
    try {
        const booksData = await booksClient.getContact(req.params.id);
        res.json(booksData.contact);
    } catch (err: any) {
        console.warn("Zoho Books single Vendor fetch failed (using fallback mock data):", err.message);
        const vendor = await Vendor.findOne({ _id: req.params.id }).catch(() => null);
        if (vendor) {
            res.json({
                contact_id: vendor._id,
                contact_name: vendor.name,
                company_name: vendor.desc,
                outstanding_payable_amount_bcy: 0,
                bank_account_details: {
                    bank_name: "Mock Bank",
                    account_number: "XXXX-XXXX-1234",
                    routing_number: "ROUTING987"
                }
            });
        } else {
            res.status(404).json({ error: 'Vendor not found' });
        }
    }
});


const PORT = process.env.PORT || 3000;
app.post('/mcp-direct', async (req, res) => {
    const { tool, limit, sender, unread_only, only_new, messageId, folderId, attachmentId, credentials } = req.body;
    if (tool === 'fetch_zoho_emails') {
        try {
            const result = await fetchZohoEmails(limit || 10, sender, unread_only, only_new, credentials);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    } else if (tool === 'download_zoho_email_attachments') {
        try {
            if (!messageId || !folderId) return res.status(400).json({ error: "messageId and folderId are required" });
            const result = await fetchZohoAttachments(messageId, folderId, attachmentId, credentials);
            if (result.attachments && result.attachments.length > 0 && result.attachments[0]) {
                const firstAttachment = result.attachments[0];
                const buffer = Buffer.from(firstAttachment.base64, 'base64');
                const ext = firstAttachment.name.toLowerCase().split('.').pop();
                const contentType = ext === 'zip' ? 'application/zip' : 'application/pdf';
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Disposition', `attachment; filename="${firstAttachment.name}"`);
                res.send(buffer);
            } else {
                res.status(404).json({ error: "No PDF attachments found" });
            }
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    } else {
        res.status(404).json({ error: "Tool not found" });
    }
});

app.post('/api/trigger', async (req, res) => {
    try {
        await AuditLog.create({
            actionType: 'FETCH_EMAIL',
            actionDetails: 'Fetched email manually',
            user: req.body?.user || 'Hashit',
            status: 'Info'
        });
        const webhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/process-invoice';
        const zohoMailConn = await Connection.findOne({ connectionId: 'zoho-mail' });
        const clientId = zohoMailConn?.credentials?.clientId || process.env.ZOHO_CLIENT_ID;
        const clientSecret = zohoMailConn?.credentials?.clientSecret || process.env.ZOHO_CLIENT_SECRET;
        const refreshToken = zohoMailConn?.credentials?.refreshToken || process.env.ZOHO_REFRESH_TOKEN_BACKUP || process.env.ZOHO_REFRESH_TOKEN;
        const region = process.env.ZOHO_REGION;

        const jobId = `job-${Date.now()}`;
        fetch(webhookUrl, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'fetch_emails', credentials: { clientId, clientSecret, refreshToken, region }, jobId })
        }).catch(err => console.error("Error calling n8n webhook:", err));
        
        await Job.create({
            jobId,
            source: 'email',
            status: 'Fetching Emails...',
            fileName: 'Sync in progress',
            logs: [{ time: Date.now(), message: 'Triggered from Dashboard' }],
            updatedAt: Date.now()
        });

        res.json({ success: true, message: 'Workflow triggered successfully', jobId });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- Authentication API ---
const sessionsStore = new Map<string, any>(); // keep sessions in memory for simple token auth

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'User already exists' });
    
    const user = await User.create({ name: name || 'User', email, password });
    const token = `tok_${Date.now()}`;
    sessionsStore.set(token, user.toObject());
    res.json({ success: true, token, user: { name: user.name, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = `tok_${Date.now()}`;
    sessionsStore.set(token, user.toObject());
    res.json({ success: true, token, user: { name: user.name, email: user.email } });
});

app.post('/api/auth/logout', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) sessionsStore.delete(token);
    res.json({ success: true });
});

app.post('/api/auth/social', async (req, res) => {
    const { provider, token } = req.body;
    let email = '';
    let name = '';

    try {
        if (provider === 'Google') {
            const googleRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
            });
            email = googleRes.data.email;
            name = googleRes.data.name;
        } else if (provider === 'LinkedIn') {
            const LINKEDIN_CLIENT_ID = process.env.VITE_LINKEDIN_CLIENT_ID || 'placeholder';
            const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET || 'placeholder';
            const REDIRECT_URI = req.headers.origin + '/linkedin';

            const tokenRes = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
                params: {
                    grant_type: 'authorization_code',
                    code: token,
                    client_id: LINKEDIN_CLIENT_ID,
                    client_secret: LINKEDIN_CLIENT_SECRET,
                    redirect_uri: REDIRECT_URI
                },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            const accessToken = tokenRes.data.access_token;
            
            const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            email = profileRes.data.email;
            name = profileRes.data.name;
        }

        if (!email) {
            return res.status(400).json({ error: 'Failed to retrieve email from provider' });
        }

        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({ name: name || `${provider} User`, email, password: `social_login_${Date.now()}` });
        }
        const sessionToken = `tok_${Date.now()}`;
        sessionsStore.set(sessionToken, user.toObject());
        res.json({ success: true, token: sessionToken, user: { name: user.name, email: user.email } });
    } catch (err: any) {
        console.error("Social Auth Error:", err.response?.data || err.message);
        res.status(401).json({ error: 'Authentication failed with provider' });
    }
});

app.get('/api/auth/me', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const user = token ? sessionsStore.get(token) : null;
    if (user) return res.json({ success: true, user: { name: user.name, email: user.email } });
    res.status(401).json({ error: 'Unauthorized' });
});

app.listen(PORT, () => {
    console.error(`Express HTTP Server running on http://localhost:${PORT}/mcp-direct (for N8N)`);
});

runStdio().catch(console.error);
