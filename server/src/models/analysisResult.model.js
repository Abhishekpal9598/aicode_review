import mongoose from 'mongoose';

/**
 * AnalysisResult Mongoose Schema
 * server/src/models/analysisResult.model.js
 *
 * Persists top-level evaluation metrics, category scores, complexity classifications,
 * and refactoring recommendations for a CodeReview.
 *
 * Supports two evaluation workflows:
 * 1. Hybrid Mode: Contains validated AI category scores and deterministic static deductions.
 * 2. Static Fallback Mode: Contains deterministic static score; all AI sub-scores are explicitly null.
 *
 * Zero fabricated defaults: AI score fields default to null when Gemini is unavailable.
 */
const integerValidator = {
  validator: (v) => v == null || Number.isInteger(v),
  message: '{PATH} must be an integer'
};

const nonNegativeIntegerValidator = {
  validator: (v) => v == null || (Number.isInteger(v) && v >= 0),
  message: '{PATH} must be a non-negative integer'
};

const analysisResultSchema = new mongoose.Schema(
  {
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CodeReview',
      required: [true, 'Parent reviewId is required'],
      unique: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner userId is required']
    },
    overallScore: {
      type: Number,
      required: [true, 'Overall quality score is required'],
      min: [0, 'Overall score cannot be less than 0'],
      max: [100, 'Overall score cannot exceed 100'],
      validate: integerValidator
    },
    grade: {
      type: String,
      required: [true, 'Letter grade is required'],
      enum: {
        values: ['A', 'B', 'C', 'D', 'F'],
        message: 'Grade must be A, B, C, D, or F'
      }
    },
    staticScore: {
      type: Number,
      required: [true, 'Deterministic static analysis score is required'],
      min: [0, 'Static score cannot be less than 0'],
      max: [100, 'Static score cannot exceed 100'],
      validate: integerValidator
    },
    aiAvailable: {
      type: Boolean,
      required: [true, 'aiAvailable flag is required']
    },
    summary: {
      type: String,
      required: [true, 'Analysis summary is required'],
      trim: true,
      maxlength: [1000, 'Summary cannot exceed 1000 characters']
    },
    metrics: {
      bugScore: {
        type: Number,
        min: [0, 'bugScore cannot be less than 0'],
        max: [100, 'bugScore cannot exceed 100'],
        default: null,
        validate: integerValidator
      },
      securityScore: {
        type: Number,
        min: [0, 'securityScore cannot be less than 0'],
        max: [100, 'securityScore cannot exceed 100'],
        default: null,
        validate: integerValidator
      },
      performanceScore: {
        type: Number,
        min: [0, 'performanceScore cannot be less than 0'],
        max: [100, 'performanceScore cannot exceed 100'],
        default: null,
        validate: integerValidator
      },
      maintainabilityScore: {
        type: Number,
        min: [0, 'maintainabilityScore cannot be less than 0'],
        max: [100, 'maintainabilityScore cannot exceed 100'],
        default: null,
        validate: integerValidator
      },
      aiCompositeScore: {
        type: Number,
        min: [0, 'aiCompositeScore cannot be less than 0'],
        max: [100, 'aiCompositeScore cannot exceed 100'],
        default: null,
        validate: integerValidator
      },
      staticDeductions: {
        type: Number,
        required: [true, 'Static deductions total is required'],
        min: [0, 'Static deductions cannot be negative'],
        default: 0,
        validate: nonNegativeIntegerValidator
      },
      issueCounts: {
        critical: { type: Number, default: 0, min: 0, validate: nonNegativeIntegerValidator },
        high: { type: Number, default: 0, min: 0, validate: nonNegativeIntegerValidator },
        medium: { type: Number, default: 0, min: 0, validate: nonNegativeIntegerValidator },
        low: { type: Number, default: 0, min: 0, validate: nonNegativeIntegerValidator },
        info: { type: Number, default: 0, min: 0, validate: nonNegativeIntegerValidator }
      }
    },
    timeComplexity: {
      type: String,
      maxlength: [50, 'timeComplexity cannot exceed 50 characters'],
      default: null
    },
    spaceComplexity: {
      type: String,
      maxlength: [50, 'spaceComplexity cannot exceed 50 characters'],
      default: null
    },
    complexityType: {
      type: String,
      enum: {
        values: ['deterministic', 'ai-assisted', 'estimated', null],
        message: 'complexityType must be deterministic, ai-assisted, estimated, or null'
      },
      default: null
    },
    suggestedCode: {
      type: String,
      default: null
    },
    refactoringRationale: {
      type: String,
      maxlength: [3000, 'refactoringRationale cannot exceed 3000 characters'],
      default: null
    },
    executionTimeMs: {
      type: Number,
      required: [true, 'Execution duration in milliseconds is required'],
      min: [0, 'Execution time cannot be negative'],
      validate: nonNegativeIntegerValidator
    }
  },
  {
    timestamps: true
  }
);

// Indexes
analysisResultSchema.index({ userId: 1, createdAt: -1 });

export const AnalysisResult = mongoose.model('AnalysisResult', analysisResultSchema);
export default AnalysisResult;
