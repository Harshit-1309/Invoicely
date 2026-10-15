import mongoose from 'mongoose';

export interface IVendor extends mongoose.Document {
    name: string;
    desc: string;
    vendorId?: string;
    bills: string;
    amount: string;
    icon: string;
    category?: string;
    date?: string;
}

const VendorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    desc: { type: String, required: true },
    vendorId: { type: String },
    bills: { type: String, required: true },
    amount: { type: String, required: true },
    icon: { type: String, required: true },
    category: { type: String },
    date: { type: String }
}, { timestamps: true });

export const Vendor = mongoose.model<IVendor>('Vendor', VendorSchema);
