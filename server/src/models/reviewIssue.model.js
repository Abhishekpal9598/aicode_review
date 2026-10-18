import mongoose from 'mongoose';

/**
 * ReviewIssue Mongoose Schema
 * server/src/models/reviewIssue.model.js
 *
 * Persists granular code review findings, defect reports, and refactoring
 * recommendations from both deterministic static rules and Gemini AI analysis.
 *
 * Source classification:
 * - 'static': Detected by deterministic lexical and syntax pattern rules.
 * - 'gemini': Identified by Gemini AI semantic reasoning.
 * - 'hybrid': Cross-verified finding identified across both analysis engines.
 */
const positiveIntegerValidator = {
  validator: (v) => v == null || (Number.isInteger(v) && v >= 1),
  message: '{PATH} must be a positive integer (>= 1)'
};

const reviewIssueSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CodeReview',
      required: [true, 'Parent reviewId is required']
    },
    analysisResultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnalysisResult',
      required: [true, 'Parent analysisResultId is required']
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner userId is required']
    },
    category: {
      type: String,
      required: [true, 'Issue category is required'],
      enum: {
        values: ['bug', 'security', 'performance', 'maintainability', 'style'],
        message: 'Category must be bug, security, performance, maintainability, or style'
      }
    },
    severity: {
      type: String,
      required: [true, 'Issue severity is required'],
      enum: {
        values: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'],
        message: 'Severity must be CRITICAL, HIGH, MEDIUM, LOW, or INFO'
      }
    },
    title: {
      type: String,
      required: [true, 'Issue title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },
    description: {
      type: String,
      required: [true, 'Issue description is required'],
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    lineStart: {
      type: Number,
      required: [true, 'lineStart coordinate is required'],
      min: [1, 'lineStart must be at least 1'],
      validate: positiveIntegerValidator
    },
    lineEnd: {
      type: Number,
      required: [true, 'lineEnd coordinate is required'],
      min: [1, 'lineEnd must be at least 1'],
      validate: [
        positiveIntegerValidator,
        {
          validator: function (val) {
            if (this.lineStart != null && val != null) {
              return val >= this.lineStart;
            }
            return true;
          },
          message: 'lineEnd cannot be less than lineStart'
        }
      ]
    },
    columnStart: {
      type: Number,
      default: 1,
      min: [1, 'columnStart must be at least 1'],
      validate: positiveIntegerValidator
    },
    columnEnd: {
      type: Number,
      default: 1,
      min: [1, 'columnEnd must be at least 1'],
      validate: [
        positiveIntegerValidator,
        {
          validator: function (val) {
            if (
              this.lineStart != null &&
              this.lineEnd != null &&
              this.columnStart != null &&
              val != null &&
              this.lineStart === this.lineEnd
            ) {
              return val >= this.columnStart;
            }
            return true;
          },
          message: 'columnEnd cannot be less than columnStart on the same line'
        }
      ]
    },
    originalSnippet: {
      type: String,
      default: '',
      maxlength: [2000, 'originalSnippet cannot exceed 2000 characters']
    },
    suggestedSnippet: {
      type: String,
      default: '',
      maxlength: [2000, 'suggestedSnippet cannot exceed 2000 characters']
    },
    explanation: {
      type: String,
      default: '',
      maxlength: [2000, 'explanation cannot exceed 2000 characters']
    },
    ruleId: {
      type: String,
      default: null,
      maxlength: [60, 'ruleId cannot exceed 60 characters']
    },
    source: {
      type: String,
      required: [true, 'Issue source origin is required'],
      enum: {
        values: ['static', 'gemini', 'hybrid'],
        message: 'Source must be static, gemini, or hybrid'
      }
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes covering review issue lookups, severity filtering, and tenant pagination
reviewIssueSchema.index({ reviewId: 1, severity: 1 });
reviewIssueSchema.index({ reviewId: 1, source: 1 });
reviewIssueSchema.index({ userId: 1, createdAt: -1 });

export const ReviewIssue = mongoose.model('ReviewIssue', reviewIssueSchema);
export default ReviewIssue;
