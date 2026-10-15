import mongoose from 'mongoose';

export interface IConnection extends mongoose.Document {
    connectionId: string;
    name: string;
    desc: string;
    category: 'active' | 'suggested';
    status: 'connected' | 'disconnected' | 'error';
    lastSync: string;
    icon: string;
    credentials?: {
      clientId?: string;
      clientSecret?: string;
      refreshToken?: string;
      region?: string;
      organizationId?: string;
      accountId?: string;
    };
}

const ConnectionSchema = new mongoose.Schema({
    connectionId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    desc: { type: String, required: true },
    category: { type: String, enum: ['active', 'suggested'], required: true },
    status: { type: String, enum: ['connected', 'disconnected', 'error'], required: true },
    lastSync: { type: String, required: true },
    icon: { type: String, required: true },
    credentials: {
        clientId: { type: String },
        clientSecret: { type: String },
        refreshToken: { type: String },
        region: { type: String },
        organizationId: { type: String },
        accountId: { type: String }
    }
}, { timestamps: true });

export const Connection = mongoose.model<IConnection>('Connection', ConnectionSchema);
