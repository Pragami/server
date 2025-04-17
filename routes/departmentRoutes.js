const express = require('express');
const router = express.Router();
const db = require('../config/database');
const util = require('util');
const { verifyToken, isAdmin, isManager } = require('../middleware/authMiddleware');

// Convert db.query to use promises
const query = util.promisify(db.query).bind(db);

// Middleware - all routes require authentication
router.use(verifyToken);

// Get all departments
router.get('/', async (req, res) => {
  try {
    const departments = await query(`
      SELECT d.*, COUNT(u.id) as member_count
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id
      GROUP BY d.id
      ORDER BY d.name
    `);
    
    res.status(200).json({
      success: true,
      count: departments.length,
      data: departments
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get single department by ID
router.get('/:id', async (req, res) => {
  try {
    const departmentId = req.params.id;
    
    const [department] = await query(`
      SELECT d.*, COUNT(u.id) as member_count
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id
      WHERE d.id = ?
      GROUP BY d.id
    `, [departmentId]);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: department
    });
  } catch (error) {
    console.error(`Error fetching department ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Create new department - admin only
router.post('/', isAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Department name is required'
      });
    }
    
    // Check if department with same name exists
    const [existingDept] = await query('SELECT id FROM departments WHERE name = ?', [name]);
    
    if (existingDept) {
      return res.status(400).json({
        success: false,
        message: 'Department with this name already exists'
      });
    }
    
    // Create department
    const department = {
      name,
      description: description || null,
      created_at: new Date()
    };
    
    const result = await query('INSERT INTO departments SET ?', department);
    
    const [newDepartment] = await query('SELECT * FROM departments WHERE id = ?', [result.insertId]);
    
    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: newDepartment
    });
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update department - admin only
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const departmentId = req.params.id;
    const { name, description } = req.body;
    
    // Check if department exists
    const [department] = await query('SELECT * FROM departments WHERE id = ?', [departmentId]);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    // Check if new name conflicts with existing department
    if (name && name !== department.name) {
      const [existingDept] = await query(
        'SELECT id FROM departments WHERE name = ? AND id != ?', 
        [name, departmentId]
      );
      
      if (existingDept) {
        return res.status(400).json({
          success: false,
          message: 'Department with this name already exists'
        });
      }
    }
    
    // Build update object
    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    updateData.updated_at = new Date();
    
    // Update department
    await query('UPDATE departments SET ? WHERE id = ?', [updateData, departmentId]);
    
    // Get updated department
    const [updatedDepartment] = await query(`
      SELECT d.*, COUNT(u.id) as member_count
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id
      WHERE d.id = ?
      GROUP BY d.id
    `, [departmentId]);
    
    res.status(200).json({
      success: true,
      message: 'Department updated successfully',
      data: updatedDepartment
    });
  } catch (error) {
    console.error(`Error updating department ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete department - admin only
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const departmentId = req.params.id;
    
    // Check if department exists
    const [department] = await query('SELECT * FROM departments WHERE id = ?', [departmentId]);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    // Check if department has users
    const [userCount] = await query(
      'SELECT COUNT(*) as count FROM users WHERE department_id = ?', 
      [departmentId]
    );
    
    if (userCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department with assigned users. Reassign users first.'
      });
    }
    
    // Check if department has tasks
    const [taskCount] = await query(
      'SELECT COUNT(*) as count FROM tasks WHERE department_id = ?', 
      [departmentId]
    );
    
    if (taskCount.count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department with assigned tasks. Reassign tasks first.'
      });
    }
    
    // Delete department
    await query('DELETE FROM departments WHERE id = ?', [departmentId]);
    
    res.status(200).json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting department ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get department members
router.get('/:id/members', async (req, res) => {
  try {
    const departmentId = req.params.id;
    
    // Check if department exists
    const [department] = await query('SELECT * FROM departments WHERE id = ?', [departmentId]);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    // Get department members
    const members = await query(`
      SELECT id, username, email, role
      FROM users
      WHERE department_id = ?
      ORDER BY username
    `, [departmentId]);
    
    res.status(200).json({
      success: true,
      count: members.length,
      data: members
    });
  } catch (error) {
    console.error(`Error fetching department ${req.params.id} members:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get department tasks
router.get('/:id/tasks', async (req, res) => {
  try {
    const departmentId = req.params.id;
    const { status } = req.query;
    
    // Check if department exists
    const [department] = await query('SELECT * FROM departments WHERE id = ?', [departmentId]);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    // Build query with possible status filter
    let sql = `
      SELECT 
        t.*,
        GROUP_CONCAT(DISTINCT u.username) as assigned_to_names,
        c.username as created_by_name
      FROM tasks t
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      LEFT JOIN users u ON ta.user_id = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.department_id = ?
      AND (t.is_deleted IS NULL OR t.is_deleted = FALSE)
    `;
    
    const queryParams = [departmentId];
    
    if (status) {
      sql += ` AND t.status = ?`;
      queryParams.push(status);
    }
    
    sql += ` GROUP BY t.id ORDER BY t.due_date ASC`;
    
    // Get department tasks
    const tasks = await query(sql, queryParams);
    
    // Format the response
    const formattedTasks = tasks.map(task => ({
      ...task,
      assigned_to_names: task.assigned_to_names ? task.assigned_to_names.split(',') : [],
      due_date: task.due_date ? task.due_date.split('T')[0] : null,
      created_at: task.created_at ? task.created_at.toString() : null,
      updated_at: task.updated_at ? task.updated_at.toString() : null
    }));
    
    res.status(200).json({
      success: true,
      count: formattedTasks.length,
      data: formattedTasks
    });
  } catch (error) {
    console.error(`Error fetching department ${req.params.id} tasks:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get department performance (for dashboard)
router.get('/:id/performance', async (req, res) => {
  try {
    const departmentId = req.params.id;
    
    // Check if department exists
    const [department] = await query('SELECT * FROM departments WHERE id = ?', [departmentId]);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    // Get task statistics
    const [taskStats] = await query(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'todo' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN status = 'awaiting_approval' THEN 1 END) as awaiting_approval_tasks,
        COUNT(CASE WHEN status = 'completed' AND updated_at <= due_date THEN 1 END) as on_time_completions
      FROM tasks
      WHERE department_id = ?
    `, [departmentId]);
    
    // Calculate performance metrics
    const totalCompleted = taskStats.completed_tasks || 0;
    const totalTasks = taskStats.total_tasks || 0;
    const onTimeCompletions = taskStats.on_time_completions || 0;
    
    const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
    const onTimeRate = totalCompleted > 0 ? Math.round((onTimeCompletions / totalCompleted) * 100) : 0;
    
    // Get monthly data for charts
    const monthlyData = await query(`
      SELECT 
        DATE_FORMAT(updated_at, '%b %Y') as period,
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END) / COUNT(*)) * 100) as completion_rate
      FROM tasks
      WHERE department_id = ? 
        AND updated_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY period
      ORDER BY MIN(updated_at)
    `, [departmentId]);
    
    // Performance score (weighted average of completion rate and on-time rate)
    const performanceScore = Math.round((completionRate * 0.6) + (onTimeRate * 0.4));
    
    res.status(200).json({
      success: true,
      data: {
        departmentId,
        departmentName: department.name,
        taskStats: {
          totalTasks,
          completedTasks: totalCompleted,
          inProgressTasks: taskStats.in_progress_tasks,
          pendingTasks: taskStats.pending_tasks,
          awaitingApprovalTasks: taskStats.awaiting_approval_tasks
        },
        performance: {
          completionRate,
          onTimeRate,
          performanceScore
        },
        monthlyData
      }
    });
  } catch (error) {
    console.error(`Error fetching department ${req.params.id} performance:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router; 