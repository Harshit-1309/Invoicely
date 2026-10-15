import mongoose from 'mongoose';

export interface IApproval extends mongoose.Document {
    approvalId: string;
    vendorName: string;
    invoiceName: string;
    amount: string;
    status: 'pending' | 'processed' | 'flagged';
    createdAt: number;
    updatedAt?: number;
    processedBy?: string;
    resumeUrl?: string;
}

const ApprovalSchema = new mongoose.Schema({
    approvalId: { type: String, required: true, unique: true },
    vendorName: { type: String, required: true },
    invoiceName: { type: String, required: true },
    amount: { type: String, required: true },
    status: { type: String, enum: ['pending', 'processed', 'flagged'], default: 'pending' },
    createdAt: { type: Number, required: true },
    updatedAt: { type: Number },
    processedBy: { type: String },
    resumeUrl: { type: String }
});

export const Approval = mongoose.model<IApproval>('Approval', ApprovalSchema);
