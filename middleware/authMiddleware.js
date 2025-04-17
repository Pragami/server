const jwt = require('jsonwebtoken');
const db = require('../config/database');
const util = require('util');

// Convert db.query to use promises
const query = util.promisify(db.query).bind(db);

// Verify JWT token
exports.verifyToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided or invalid format.'
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if user exists
    const [user] = await query('SELECT id, username, email, role, department_id FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User does not exist.'
      });
    }
    
    // Set user in request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in auth middleware',
      error: error.message
    });
  }
};

// Admin role check middleware
exports.isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// Department manager check middleware
exports.isDepartmentManager = async (req, res, next) => {
  try {
    // Admins can access any department
    if (req.user.role === 'admin') {
      return next();
    }
    
    // If not a manager, deny access
    if (req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Manager privileges required.'
      });
    }
    
    // Get department ID from request parameters
    const departmentId = req.params.departmentId || req.params.id || req.body.department_id;
    
    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Department ID is required'
      });
    }
    
    // Check if user is manager of the specified department
    if (req.user.department_id != departmentId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only manage your own department.'
      });
    }
    
    next();
  } catch (error) {
    console.error('Department manager check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in department manager middleware',
      error: error.message
    });
  }
}; 