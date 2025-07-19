import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  image?: string;
  emailVerified?: Date;
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
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
      trim: true,
      validate: {
        validator: function(v: string) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Image URL must be a valid HTTP/HTTPS URL'
      }
    },
    lastLogin: {
      type: Date,
      default: null
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
UserSchema.index({ createdAt: -1 }); // For recent user queries
UserSchema.index({ lastLogin: -1 }); // For active user queries

// Add middleware to update lastLogin
UserSchema.pre('save', function(next) {
  if (this.isModified('emailVerified') && this.emailVerified) {
    this.lastLogin = new Date();
  }
  next();
});

// Add instance method to update lastLogin
UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  return this.save();
};

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
