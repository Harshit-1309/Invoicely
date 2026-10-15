import mongoose from 'mongoose';

export interface IJobLog {
    time: number;
    message: string;
}

export interface IJob extends mongoose.Document {
    jobId: string;
    source: string;
    status: string;
    vendor?: string;
    amount?: string;
    fileName?: string;
    logs: IJobLog[];
    updatedAt: number;
    timestamp?: number;
    result?: any;
}

const JobSchema = new mongoose.Schema({
    jobId: { type: String, required: true, unique: true },
    source: { type: String, required: true },
    status: { type: String, required: true },
    vendor: { type: String },
    amount: { type: String },
    fileName: { type: String },
    logs: [{
        time: { type: Number },
        message: { type: String }
    }],
    updatedAt: { type: Number, required: true },
    timestamp: { type: Number },
    result: { type: mongoose.Schema.Types.Mixed }
});

export const Job = mongoose.model<IJob>('Job', JobSchema);
