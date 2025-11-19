// models/RDAccount.ts
import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Interface describing the structure of a Recurring Deposit Account document.
 */
export interface IRDAccount extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId; // reference to User
  accountNo: string;
  accountName: string;
  openingDate: Date;
  denomination: Types.Decimal128; // Use Decimal128 for precise currency values
  totalDepositAmount: Types.Decimal128; // persisted total (denomination * monthPaidUpTo)
  monthPaidUpTo: number;
  nextInstallmentDueDate: Date;
  lastDepositDate?: Date; // Optional: May not exist for a new account
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose Schema for the RDAccount.
 */
const RDAccountSchema = new Schema<IRDAccount>({
  accountNo: { 
    type: String, 
    required: [true, 'Account number is required'], 
    index: true,      // Create an index for faster queries by account number
    trim: true 
  },
  accountName: { 
    type: String, 
    required: [true, 'Account name is required'], 
    trim: true 
  },
  openingDate: { 
    type: Date, 
    required: [true, 'Account opening date is required'] 
  },
  denomination: { 
    type: Schema.Types.Decimal128, // Best type for storing money
    required: [true, 'Denomination is required'] 
  },
  totalDepositAmount: {
    type: Schema.Types.Decimal128,
    required: true,
    default: mongoose.Types.Decimal128.fromString('0')
  },
  monthPaidUpTo: { 
    type: Number, 
    required: [true, 'Month paid up to is required'],
    default: 0
  },
  nextInstallmentDueDate: { 
    type: Date, 
    required: [true, 'Next installment due date is required'] 
  },
  lastDepositDate: { 
    type: Date,
    required: false // This field is optional
  }
  ,
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Associated user is required'],
    index: true
  }
}, {
  /**
   * Automatically manage createdAt and updatedAt timestamps.
   * This replaces the need for a pre-save hook for 'updatedAt'.
   */
  timestamps: true 
});

/**
 * Add compound index to ensure accountNo is unique per user
 */
RDAccountSchema.index({ accountNo: 1, user: 1 }, { unique: true });

/**
 * Create and export the Mongoose model.
 * This pattern avoids recompiling the model in Next.js hot-reload environments.
 */
const RDAccountModel = (mongoose.models.RDAccount as mongoose.Model<IRDAccount>) || 
                       mongoose.model<IRDAccount>('RDAccount', RDAccountSchema);

export default RDAccountModel;