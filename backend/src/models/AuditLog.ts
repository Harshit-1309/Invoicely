import mongoose from 'mongoose';

export interface IAuditLog extends mongoose.Document {
  actionType: string;
  actionDetails: string;
  user: string;
  timestamp: Date;
  status?: string;
  source?: string;
  entityName?: string;
  entityId?: string;
  correlationId?: string;
  errorDetails?: string;
}

const auditLogSchema = new mongoose.Schema({
  actionType: { type: String, required: true },
  actionDetails: { type: String, required: true },
  user: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['Success', 'Info', 'Warning', 'Error'], default: 'Info' },
  source: { type: String, default: 'System' },
  entityName: { type: String },
  entityId: { type: String },
  correlationId: { type: String },
  errorDetails: { type: String }
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
