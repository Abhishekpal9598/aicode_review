export const getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI Code Review API is running',
    status: 'healthy'
  });
};
