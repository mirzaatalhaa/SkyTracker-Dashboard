export const getHealth = (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      message: 'SkyTracker backend is healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  });
};
