const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { verifyToken, isAdmin, isManager } = require('../middleware/authMiddleware');

// All analytics routes are protected
router.use(verifyToken);

// Only admins and managers can access analytics
router.use(function(req, res, next) {
  if (req.user.role === 'admin' || req.user.role === 'manager') {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: "Access denied. You must be an admin or manager to access analytics."
  });
});

// Department analytics routes
router.get('/departments', analyticsController.getDepartmentAnalytics);
router.get('/departments/:id', analyticsController.getDepartmentDetails);

// Employee analytics routes
router.get('/employees', analyticsController.getEmployeeAnalytics);
router.get('/employees/:id', analyticsController.getEmployeeDetails);

// Performance metrics dashboard
router.get('/performance', analyticsController.getPerformanceAnalytics);

// Company analytics route
router.get('/company', analyticsController.getCompanyAnalytics);

module.exports = router; 