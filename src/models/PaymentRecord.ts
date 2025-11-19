import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPaymentRecordSnapshot {
  monthPaidUpTo: number;
  totalDepositAmount: Types.Decimal128;
  nextInstallmentDueDate: Date;
  lastDepositDate?: Date;
}

export interface IPaymentRecord extends Document {
  _id: Types.ObjectId;
  batchId?: Types.ObjectId;
  agent: Types.ObjectId;
  user: Types.ObjectId;
  account: Types.ObjectId;
  installments: number;
  denomination: Types.Decimal128;
  amount: Types.Decimal128;
  before: IPaymentRecordSnapshot;
  after: IPaymentRecordSnapshot;
  paymentMethod?: string;
  reversed?: boolean;
  reversalOf?: Types.ObjectId;
  paymentDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SnapshotSchema = new Schema<IPaymentRecordSnapshot>({
  monthPaidUpTo: { type: Number, required: true },
  totalDepositAmount: { type: Schema.Types.Decimal128, required: true },
  nextInstallmentDueDate: { type: Date, required: true },
  lastDepositDate: Date
}, { _id: false });

const PaymentRecordSchema = new Schema<IPaymentRecord>({
  batchId: { 
    type: Schema.Types.ObjectId, 
    ref: 'PaymentSession',
    index: true
  },
  agent: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  user: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  account: { 
    type: Schema.Types.ObjectId, 
    ref: 'RDAccount', 
    required: true,
    index: true
  },
  installments: { type: Number, required: true },
  denomination: { type: Schema.Types.Decimal128, required: true },
  amount: { type: Schema.Types.Decimal128, required: true },
  before: { type: SnapshotSchema, required: true },
  after: { type: SnapshotSchema, required: true },
  paymentMethod: String,
  reversed: { type: Boolean, default: false },
  reversalOf: { 
    type: Schema.Types.ObjectId, 
    ref: 'PaymentRecord'
  },
  paymentDate: { type: Date, default: () => new Date() }
}, { 
  timestamps: true 
});

// Compound indexes
PaymentRecordSchema.index({ account: 1, paymentDate: -1 });
PaymentRecordSchema.index({ batchId: 1, account: 1 });

const PaymentRecordModel = 
  (mongoose.models.PaymentRecord as mongoose.Model<IPaymentRecord>) || 
  mongoose.model<IPaymentRecord>('PaymentRecord', PaymentRecordSchema);

export default PaymentRecordModel;
