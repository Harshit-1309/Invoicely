import mongoose from 'mongoose';
import { AuditLog } from './src/models/AuditLog.js';
import { Job } from './src/models/Job.js';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/invoicely_db');
  const actionTypes = await AuditLog.distinct('actionType');
  const jobStatuses = await Job.distinct('status');
  console.log('Action Types:', actionTypes);
  console.log('Job Statuses:', jobStatuses);
  mongoose.disconnect();
}
run();
