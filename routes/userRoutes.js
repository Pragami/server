const express = require('express');
const router = express.Router();
const db = require('../config/database');
const util = require('util');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Convert db.query to use promises
const query = util.promisify(db.query).bind(db);

// Middleware - all routes require authentication
router.use(verifyToken);

// Get all users
router.get('/', async (req, res) => {
  try {
    // Only admins and managers can list all users
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied'
      });
    }
    
    const users = await query(`
      SELECT u.id, u.username, u.email, u.role, u.department_id, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      ORDER BY u.id
    `);
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get single user by ID
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Users can only view their own profile unless they're admin/manager
    if (req.user.id != userId && req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied'
      });
    }
    
    const [user] = await query(`
      SELECT u.id, u.username, u.email, u.role, u.department_id, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `, [userId]);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(`Error fetching user ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { username, email, role, department_id, password } = req.body;
    
    // Users can only update their own profile unless they're admin
    if (req.user.id != userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied'
      });
    }
    
    if (role && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can change user roles'
      });
    }
    
    // Check if user exists
    const [user] = await query('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Build update query based on provided fields
    const updateData = {};
    const updatedFields = [];

    if (username && username !== user.username) {
      updateData.username = username;
      updatedFields.push('username');
    }
    if (email && email !== user.email) {
      updateData.email = email;
      updatedFields.push('email');
    }
    if (role && req.user.role === 'admin' && role !== user.role) {
      updateData.role = role;
      updatedFields.push('role');
    }
    if (department_id !== undefined && department_id !== user.department_id) {
      updateData.department_id = department_id || null;
      updatedFields.push('department');
    }
    
    // Handle password update
    if (password) {
      const bcrypt = require('bcrypt');
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
      updatedFields.push('password');
    }
    
    // Only proceed with update if there are fields to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No changes detected in the provided data'
      });
    }
    
    try {
      // Update the user
      await query('UPDATE users SET ? WHERE id = ?', [updateData, userId]);
      
      // Get updated user
      const [updatedUser] = await query(`
        SELECT u.id, u.username, u.email, u.role, u.department_id, d.name as department_name
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = ?
      `, [userId]);

      // Create success message based on what was updated
      let successMessage = 'Updated: ' + updatedFields.join(', ');
      
      res.status(200).json({
        success: true,
        message: successMessage,
        updatedFields: updatedFields,
        data: updatedUser
      });
    } catch (dbError) {
      if (dbError.code === 'ER_DUP_ENTRY') {
        if (dbError.sqlMessage.includes('username')) {
          return res.status(400).json({
            success: false,
            message: 'Username is already taken. Please choose a different username.'
          });
        } else if (dbError.sqlMessage.includes('email')) {
          return res.status(400).json({
            success: false,
            message: 'Email address is already in use. Please use a different email.'
          });
        }
      }
      throw dbError;
    }
  } catch (error) {
    console.error(`Error updating user ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.sqlMessage || 'Server error occurred while updating user',
      error: error.message
    });
  }
});

// Delete user - admin only
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Check if user exists
    const [user] = await query('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Start a transaction
    await query('START TRANSACTION');
    
    try {
      // Delete task assignments
      await query('DELETE FROM task_assignments WHERE user_id = ?', [userId]);
      
      // Update tasks where this user is the creator
      const [adminUser] = await query('SELECT id FROM users WHERE role = "admin" AND id != ? LIMIT 1', [userId]);
      if (adminUser) {
        await query('UPDATE tasks SET created_by = ? WHERE created_by = ?', [adminUser.id, userId]);
      }
      
      // Finally, delete the user
      await query('DELETE FROM users WHERE id = ?', [userId]);
      
      // If everything succeeded, commit the transaction
      await query('COMMIT');
      
      res.status(200).json({
        success: true,
        message: `Successfully deleted user ${user.username} and reassigned their tasks`
      });
    } catch (err) {
      // If anything fails, rollback the transaction
      await query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error(`Error deleting user ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user. They may have associated tasks or other data.',
      error: error.message
    });
  }
});

module.exports = router; 