const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { verifyToken } = require('../middleware/authMiddleware');

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }
    
    // Get user with provided email
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('Login query error:', err);
        return res.status(500).json({
          success: false,
          message: 'Server error during login',
          error: err.message
        });
      }
      
      if (results.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      const user = results[0];
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
      
      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );
      
      // Return user info and token
      res.status(200).json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          department_id: user.department_id
        },
        token
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, role, department_id } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email and password'
      });
    }
    
    // Check if email already exists
    db.query('SELECT id FROM users WHERE email = ?', [email], async (err, results) => {
      if (err) {
        console.error('Register email check error:', err);
        return res.status(500).json({
          success: false,
          message: 'Server error',
          error: err.message
        });
      }
      
      if (results.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      // Create new user
      const user = {
        username,
        email,
        password: hashedPassword,
        role: role || 'employee',
        department_id: department_id || null,
        created_at: new Date()
      };
      
      db.query('INSERT INTO users SET ?', user, (err, result) => {
        if (err) {
          console.error('Register insert error:', err);
          return res.status(500).json({
            success: false,
            message: 'Failed to register user',
            error: err.message
          });
        }
        
        // Generate JWT token
        const token = jwt.sign(
          { id: result.insertId, email: user.email, role: user.role },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        );
        
        res.status(201).json({
          success: true,
          message: 'Registration successful',
          user: {
            id: result.insertId,
            username: user.username,
            email: user.email,
            role: user.role,
            department_id: user.department_id
          },
          token
        });
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Check token validity
router.get('/verify', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  });
});

// Refresh token
router.post('/refresh-token', (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Token is required'
    });
  }
  
  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Generate a new token
    const newToken = jwt.sign(
      { id: decoded.id, email: decoded.email, role: decoded.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
    
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: error.message
    });
  }
});

module.exports = router; 