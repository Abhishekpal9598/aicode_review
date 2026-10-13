export const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Internal server error occurred',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};
