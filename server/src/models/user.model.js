import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name cannot exceed 60 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false // Never return password hash in regular queries
    },
    role: {
      type: String,
      enum: {
        values: ['developer', 'lead', 'admin'],
        message: 'Role must be either developer, lead, or admin'
      },
      default: 'developer'
    },
    avatarUrl: {
      type: String,
      default: null
    },
    preferences: {
      editorTheme: {
        type: String,
        enum: ['vs-dark', 'charcoal-obsidian'],
        default: 'charcoal-obsidian'
      },
      tabSize: {
        type: Number,
        min: 2,
        max: 8,
        default: 2
      },
      defaultLanguage: {
        type: String,
        enum: ['c', 'cpp', 'java', 'python', 'javascript', 'typescript'],
        default: 'python'
      }
    },
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

/**
 * Compare entered password against stored bcrypt hash.
 * @param {string} enteredPassword
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordMatch = async function (enteredPassword) {
  if (!this.passwordHash) {
    throw new Error('Password hash not loaded on user model instance.');
  }
  return bcrypt.compare(enteredPassword, this.passwordHash);
};

/**
 * Serialize user to safe JSON object (omits passwordHash and internal fields).
 * Maps `_id` to string `id`.
 * @returns {object}
 */
userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  const safeUser = {
    id: obj._id.toString(),
    name: obj.name,
    email: obj.email,
    role: obj.role,
    avatarUrl: obj.avatarUrl,
    preferences: obj.preferences,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt
  };
  return safeUser;
};

export const User = mongoose.model('User', userSchema);
export default User;
