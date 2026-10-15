import mongoose from 'mongoose';

export interface IAccount extends mongoose.Document {
    name: string;
    type: string;
    typeClass?: string;
    tax?: string;
    balance?: string;
    color?: string;
}

const AccountSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    typeClass: { type: String },
    tax: { type: String },
    balance: { type: String },
    color: { type: String }
}, { timestamps: true });

export const Account = mongoose.model<IAccount>('Account', AccountSchema);
