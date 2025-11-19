import mongoose , { Schema, Document, Types } from 'mongoose';
export interface User extends Document {
            username: string;
            email: string;
            password: string;
            role: 'Agent' | 'User';
            myRegisterAccount: Types.ObjectId[]; // stores RDAccount ids
            createdAt: Date;
}

const userSchema: Schema<User> = new Schema({
            username: { type: String, required: [true, "username is required"], trim : true, unique: true },
            email: { type: String, required: [true, "email is required"], unique: true, match: [/\S+@\S+\.\S+/, 'please enter the valid email'] },
            password: { type: String, required: [true, "password is required"] },
            role: { type: String, enum: ['Agent', 'User'], default: 'User' },
            myRegisterAccount: [{ type: Schema.Types.ObjectId, ref: 'RDAccount', default: [] }],
            createdAt: { type: Date, default: Date.now },
});

const UserModel =
  (mongoose.models.User as mongoose.Model<User>) ||
  mongoose.model<User>('User', userSchema);

export default UserModel;