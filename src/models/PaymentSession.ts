import mongoose, { Schema, Document, Types } from 'mongoose';

// PaymentSession model for managing bulk RD account payments
export interface IPaymentSessionItem {
  account: Types.ObjectId;
  installments: number;
  denomination: Types.Decimal128;
  contribution: Types.Decimal128;
  added: boolean;
}

export interface IPaymentSession extends Document {
  _id: Types.ObjectId;
  agent: Types.ObjectId;
  user: Types.ObjectId;
  items: IPaymentSessionItem[];
  totalAmount: Types.Decimal128;
  status: 'draft' | 'ongoing' | 'submitted' | 'committed' | 'cancelled';
  paymentMethod?: 'cash' | 'check';
  checkInfo?: {
    number?: string;
    bank?: string;
    issueDate?: Date;
  };
  idempotencyKey?: string;
  committedAt?: Date;
  allowRevertUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSessionItemSchema = new Schema<IPaymentSessionItem>({
  account: { 
    type: Schema.Types.ObjectId, 
    ref: 'RDAccount', 
    required: true,
    index: true
  },
  installments: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 12 
  },
  denomination: { 
    type: Schema.Types.Decimal128, 
    required: true 
  },
  contribution: { 
    type: Schema.Types.Decimal128, 
    required: true 
  },
  added: { 
    type: Boolean, 
    default: false 
  }
}, { _id: false });

const PaymentSessionSchema = new Schema<IPaymentSession>({
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
  items: { 
    type: [PaymentSessionItemSchema], 
    default: [] 
  },
  totalAmount: { 
    type: Schema.Types.Decimal128, 
    default: mongoose.Types.Decimal128.fromString('0')
  },
  status: { 
    type: String, 
    enum: ['draft', 'ongoing', 'submitted', 'committed', 'cancelled'], 
    default: 'draft',
    index: true
  },
  paymentMethod: { 
    type: String, 
    enum: ['cash', 'check'],
    default: 'cash'
  },
  checkInfo: {
    number: String,
    bank: String,
    issueDate: Date
  },
  idempotencyKey: { 
    type: String,
    sparse: true,
    unique: true
  },
  committedAt: Date,
  allowRevertUntil: Date
}, { 
  timestamps: true 
});

// Compound indexes
PaymentSessionSchema.index({ agent: 1, status: 1 });
PaymentSessionSchema.index({ user: 1, status: 1 });
PaymentSessionSchema.index({ agent: 1, user: 1, status: 1 });

const PaymentSessionModel = 
  (mongoose.models.PaymentSession as mongoose.Model<IPaymentSession>) || 
  mongoose.model<IPaymentSession>('PaymentSession', PaymentSessionSchema);

export default PaymentSessionModel;
