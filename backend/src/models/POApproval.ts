import mongoose from 'mongoose';

const POApprovalSchema = new mongoose.Schema({
    vendorName: { type: String, required: true },
    vendorId: { type: String }, // Optional
    poNumber: { type: String, required: true },
    amount: { type: Number },
    status: { type: String, enum: ['pending', 'processed', 'rejected'], default: 'pending' },
    resumeUrl: { type: String, required: true }, // The n8n webhook URL to resume the workflow
    bankDetails: { type: Object }, // Extracted bank details
    createdAt: { type: Date, default: Date.now },
});

export const POApproval = mongoose.model('POApproval', POApprovalSchema);
