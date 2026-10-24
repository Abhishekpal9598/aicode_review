import mongoose from 'mongoose';

const codeReviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner userId is required']
      // Omit index: true to avoid redundant single-field index.
      // The compound index below already satisfies userId prefix queries.
    },
    title: {
      type: String,
      required: [true, 'Review title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters']
    },
    sourceType: {
      type: String,
      required: [true, 'Source type is required'],
      enum: {
        values: ['pasted', 'upload'],
        message: 'Source type must be either pasted or upload'
      }
    },
    filename: {
      type: String,
      maxlength: [120, 'Filename cannot exceed 120 characters'],
      default: 'snippet'
    },
    language: {
      type: String,
      required: [true, 'Language is required'],
      enum: {
        values: ['c', 'cpp', 'java', 'python', 'javascript', 'typescript'],
        message: 'Unsupported programming language'
      }
    },
    rawCode: {
      type: String,
      required: [true, 'Source code is required'],
      maxlength: [1000000, 'Source code exceeds maximum allowed size (1 MB)']
    },
    lineCount: {
      type: Number,
      required: [true, 'Line count is required'],
      min: [1, 'Line count must be at least 1']
    },
    characterCount: {
      type: Number,
      required: [true, 'Character count is required'],
      min: [1, 'Character count must be at least 1']
    },
    fileSizeBytes: {
      type: Number,
      required: [true, 'File size is required']
    },
    status: {
      type: String,
      enum: ['pending', 'analyzing', 'completed', 'failed'],
      default: 'pending'
    },
    reviewMode: {
      type: String,
      enum: ['hybrid', 'static-fallback'],
      default: 'hybrid'
    },
    aiModelUsed: {
      type: String,
      default: null,
      maxlength: [100, 'aiModelUsed cannot exceed 100 characters']
    },
    aiModelTier: {
      type: String,
      enum: {
        values: ['primary', 'fallback', 'static-fallback', null],
        message: 'aiModelTier must be primary, fallback, static-fallback, or null'
      },
      default: null
    },
    staticScore: {
      type: Number,
      min: [0, 'Static score cannot be less than 0'],
      max: [100, 'Static score cannot exceed 100'],
      default: 100
    },
    errorMessage: {
      type: String,
      default: null
    },
    currentCode: {
      type: String,
      maxlength: [1000000, 'Current code exceeds maximum allowed size (1 MB)'],
      default: null
    },
    appliedFixes: [
      {
        issueId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ReviewIssue',
          default: null
        },
        ruleId: {
          type: String,
          default: null,
          maxlength: [60, 'ruleId cannot exceed 60 characters']
        },
        lineStart: {
          type: Number,
          required: [true, 'lineStart is required for applied fix'],
          min: [1, 'lineStart must be at least 1']
        },
        lineEnd: {
          type: Number,
          required: [true, 'lineEnd is required for applied fix'],
          min: [1, 'lineEnd must be at least 1']
        },
        previousSnippet: {
          type: String,
          default: '',
          maxlength: [2000, 'previousSnippet cannot exceed 2000 characters']
        },
        appliedSnippet: {
          type: String,
          default: '',
          maxlength: [2000, 'appliedSnippet cannot exceed 2000 characters']
        },
        appliedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Revision 2.1 Compound indexes: user history, language filtering, and text search
codeReviewSchema.index({ userId: 1, createdAt: -1 });
codeReviewSchema.index({ userId: 1, language: 1, createdAt: -1 });
codeReviewSchema.index({ title: 'text', filename: 'text' }, { language_override: 'none' });

export const CodeReview = mongoose.model('CodeReview', codeReviewSchema);
export default CodeReview;
