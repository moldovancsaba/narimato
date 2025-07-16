import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  image?: string;
  emailVerified?: Date;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name must be 50 characters or less']
    },
    image: {
      type: String,
      trim: true
    },
    emailVerified: Date,
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Create indexes for improved query performance
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1 });

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
