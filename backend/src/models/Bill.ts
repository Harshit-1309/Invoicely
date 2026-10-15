import mongoose from 'mongoose';

export interface IBill extends mongoose.Document {
    id: string; // The bill id/number
    vendorName: string;
    vendorInitials: string;
    date: string;
    amount: string;
    status: string;
    statusClass: string;
}

const BillSchema = new mongoose.Schema({
    id: { type: String, required: true },
    vendorName: { type: String, required: true },
    vendorInitials: { type: String, required: true },
    date: { type: String, required: true },
    amount: { type: String, required: true },
    status: { type: String, required: true },
    statusClass: { type: String, required: true }
}, { timestamps: true });

export const Bill = mongoose.model<IBill>('Bill', BillSchema);
