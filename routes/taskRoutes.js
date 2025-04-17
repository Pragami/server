const express = require('express');
const router = express.Router();
const db = require('../config/database');
const util = require('util');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

// Convert db.query to use promises
const query = util.promisify(db.query).bind(db);

// Middleware - all routes require authentication
router.use(verifyToken);

// Add middleware to log all requests
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Get all tasks
router.get('/', async (req, res) => {
  try {
    // Filter options
    const { status, priority, departmentId, assignedTo } = req.query;
    
    // Base query with assignments and proper joins
    let sql = `
      SELECT 
        t.*,
        d.name as department_name,
        c.username as created_by_name,
        CONCAT('[', 
          GROUP_CONCAT(
            DISTINCT
            JSON_OBJECT(
              'user_id', ta.user_id,
              'username', u.username,
              'assigned_at', ta.assigned_at,
              'assigned_by_name', au.username
            )
          ),
        ']') as assignees
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users c ON t.created_by = c.id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      LEFT JOIN users u ON ta.user_id = u.id
      LEFT JOIN users au ON ta.assigned_by = au.id
      WHERE t.is_deleted = FALSE AND t.status != 'trashed'
    `;
    
    const queryParams = [];
    
    // Apply filters if provided
    if (status) {
      sql += ` AND t.status = ?`;
      queryParams.push(status);
    }
    
    if (priority) {
      sql += ` AND t.priority = ?`;
      queryParams.push(priority);
    }
    
    if (departmentId) {
      sql += ` AND t.department_id = ?`;
      queryParams.push(departmentId);
    }
    
    if (assignedTo) {
      sql += ` AND ta.user_id = ?`;
      queryParams.push(assignedTo);
    }
    
    // Regular employees can only see their tasks or department's tasks
    if (req.user.role === 'employee') {
      sql += ` AND (ta.user_id = ? OR t.department_id = ?)`;
      queryParams.push(req.user.id, req.user.department_id);
    }
    
    // Group by to handle multiple assignments
    sql += ` GROUP BY t.id`;
    
    // Order by due date, most urgent first
    sql += ` ORDER BY t.due_date ASC`;
    
    const tasks = await query(sql, queryParams);
    
    // Format tasks data
    const formattedTasks = tasks.map(task => ({
      ...task,
      assignees: task.assignees ? JSON.parse(task.assignees) : [],
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
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get assigned tasks (for current user)
router.get('/assigned', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const tasks = await query(`
      SELECT DISTINCT t.*, 
        d.name as department_name, 
        c.username as created_by_name,
        CONCAT('[', 
          GROUP_CONCAT(
            DISTINCT
            JSON_OBJECT(
              'user_id', ta.user_id,
              'username', u.username,
              'assigned_at', ta.assigned_at,
              'assigned_by_name', au.username
            )
          ),
        ']') as assignees
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users c ON t.created_by = c.id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      LEFT JOIN users u ON ta.user_id = u.id
      LEFT JOIN users au ON ta.assigned_by = au.id
      WHERE ta.user_id = ?
      GROUP BY t.id
      ORDER BY t.due_date ASC
    `, [userId]);

    // Format tasks data
    const formattedTasks = tasks.map(task => ({
      ...task,
      assignees: task.assignees ? JSON.parse(task.assignees) : [],
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
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get tasks pending approval (for managers/admins)
router.get('/pending-approvals', async (req, res) => {
  try {
    // Only admins can view pending approvals
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied'
      });
    }
    
    let sql = `
      SELECT t.*, 
        d.name as department_name,
        u.username as created_by_name,
        assigned_user.username as assigned_to_name
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      LEFT JOIN users assigned_user ON ta.user_id = assigned_user.id
      WHERE t.status = 'awaiting_approval'
      AND t.is_deleted = 0
    `;
    
    // Execute query
    const tasks = await query(sql);
    
    res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks
    });
  } catch (error) {
    console.error('Error fetching pending approvals:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get trashed tasks
router.get('/trashed', async (req, res) => {
  try {
    // Only admins can see trashed tasks
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can view trashed tasks'
      });
    }
    
    // Get all trashed tasks with proper joins
    const trashedTasks = await query(`
      SELECT 
        t.*,
        d.name as department_name,
        c.username as created_by_name,
        CONCAT('[', 
          GROUP_CONCAT(
            DISTINCT
            JSON_OBJECT(
              'user_id', ta.user_id,
              'username', u.username,
              'assigned_at', ta.assigned_at,
              'assigned_by_name', au.username
            )
          ),
        ']') as assignees
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users c ON t.created_by = c.id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      LEFT JOIN users u ON ta.user_id = u.id
      LEFT JOIN users au ON ta.assigned_by = au.id
      WHERE t.status = 'trashed' AND t.is_deleted = true
      GROUP BY t.id
      ORDER BY t.deleted_at DESC
    `);
    
    // Process the assignees string into a proper array
    const processedTasks = trashedTasks.map(task => ({
      ...task,
      assignees: task.assignees ? JSON.parse(task.assignees) : []
    }));
    
    res.status(200).json({
      success: true,
      count: processedTasks.length,
      data: processedTasks
    });
  } catch (error) {
    console.error('Error fetching trashed tasks:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// POST alternative for trashing tasks (to avoid route conflicts)
router.post('/:id/trash', async (req, res) => {
  try {
    const taskId = req.params.id;
    console.log(`Attempting to trash task ID: ${taskId}`);
    
    // Check if task exists
    const [task] = await query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    
    if (!task) {
      console.log(`Task ID ${taskId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    console.log(`Found task: ${JSON.stringify(task)}`);
    
    // Check if 'trashed' is a valid status value
    const [validStatuses] = await query("SHOW COLUMNS FROM tasks LIKE 'status'");
    console.log('Valid statuses:', validStatuses.Type);
    
    if (validStatuses && validStatuses.Type) {
      // Extract enum values
      const enumValues = validStatuses.Type.match(/'([^']*)'/g);
      console.log('Enum values:', enumValues);
      
      if (!enumValues || !enumValues.includes("'trashed'")) {
        console.error("The 'trashed' status is not defined in the status enum");
        return res.status(500).json({
          success: false,
          message: "Database schema doesn't support 'trashed' status"
        });
      }
    }
    
    // Check permissions - only admins, managers, or task creators can trash
    if (req.user.role !== 'admin' && 
        task.created_by !== req.user.id) {
      console.log(`Permission denied for user ${req.user.id} with role ${req.user.role}`);
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to trash this task'
      });
    }
    
    // Move the task to trash
    console.log(`Updating task ${taskId} to trashed state`);
    const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await query(
      'UPDATE tasks SET status = ?, is_deleted = ?, deleted_at = ? WHERE id = ?', 
      ['trashed', 1, currentTimestamp, taskId]
    );
    
    // Log the action
    console.log(`Logging trash action to history`);
    await query(
      'INSERT INTO task_history (task_id, user_id, action) VALUES (?, ?, ?)',
      [taskId, req.user.id, 'Moved task to trash']
    );
    
    console.log(`Successfully trashed task ${taskId}`);
    res.status(200).json({
      success: true,
      message: 'Task moved to trash successfully'
    });
  } catch (error) {
    console.error(`Error trashing task ${req.params.id}:`, error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Restore task from trash
router.put('/:id/restore', async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Check if task exists and is in trash
    const [task] = await query(
      'SELECT * FROM tasks WHERE id = ? AND status = "trashed" AND is_deleted = true', 
      [taskId]
    );
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found in trash'
      });
    }
    
    // Check permissions - only admins can restore from trash
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can restore tasks from trash'
      });
    }
    
    // Restore the task
    await query(
      'UPDATE tasks SET status = ?, is_deleted = ?, deleted_at = ? WHERE id = ?', 
      ['pending', false, null, taskId]
    );
    
    // Log the action
    await query(
      'INSERT INTO task_history (task_id, user_id, action) VALUES (?, ?, ?)',
      [taskId, req.user.id, 'Restored task from trash']
    );
    
    res.status(200).json({
      success: true,
      message: 'Task restored successfully'
    });
  } catch (error) {
    console.error(`Error restoring task ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Permanently delete a task
router.delete('/:id/permanent', async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Check if task exists and is in trash
    const [task] = await query(
      'SELECT * FROM tasks WHERE id = ? AND status = "trashed" AND is_deleted = true', 
      [taskId]
    );
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found in trash'
      });
    }
    
    // Check permissions - only admins can permanently delete
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can permanently delete tasks'
      });
    }
    
    // Delete related records
    await query('DELETE FROM task_assignments WHERE task_id = ?', [taskId]);
    await query('DELETE FROM task_comments WHERE task_id = ?', [taskId]);
    
    // Log the action before deleting history
    await query(
      'INSERT INTO task_history (task_id, user_id, action) VALUES (?, ?, ?)',
      [taskId, req.user.id, 'Permanently deleted task']
    );
    
    // Delete task history
    await query('DELETE FROM task_history WHERE task_id = ?', [taskId]);
    
    // Delete the task
    await query('DELETE FROM tasks WHERE id = ?', [taskId]);
    
    res.status(200).json({
      success: true,
      message: 'Task permanently deleted'
    });
  } catch (error) {
    console.error(`Error permanently deleting task ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get single task by ID
router.get('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // First check if task exists
    const [taskExists] = await query('SELECT id FROM tasks WHERE id = ?', [taskId]);
    
    if (!taskExists) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Fetch task with all related data
    const [task] = await query(`
      SELECT 
        t.*,
        d.name as department_name,
        c.username as created_by_name,
        CONCAT('[', 
          GROUP_CONCAT(
            JSON_OBJECT(
              'user_id', ta.user_id,
              'username', u.username,
              'assigned_at', ta.assigned_at,
              'assigned_by_name', au.username
            )
          ),
        ']') as assignees
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users c ON t.created_by = c.id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      LEFT JOIN users u ON ta.user_id = u.id
      LEFT JOIN users au ON ta.assigned_by = au.id
      WHERE t.id = ?
      GROUP BY t.id
    `, [taskId]);
    
    // Handle case where task has no assignees
    if (task) {
      // Parse assignees string or set empty array if null
      task.assignees = task.assignees ? JSON.parse(task.assignees) : [];
      
      // Ensure status is never null
      task.status = task.status || 'pending';
      
      // Format dates - MySQL returns dates as strings, so we don't need to call toISOString
      task.due_date = task.due_date ? task.due_date.split('T')[0] : null;
      task.created_at = task.created_at ? task.created_at.toString() : null;
      task.updated_at = task.updated_at ? task.updated_at.toString() : null;
    }
    
    // Check if user has permission to view this task
    if (req.user.role === 'employee') {
      const isAssigned = task.assignees.some(a => a.user_id === req.user.id);
      const isCreator = task.created_by === req.user.id;
      const isSameDepartment = task.department_id === req.user.department_id;
      
      if (!isAssigned && !isCreator && !isSameDepartment) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view this task'
        });
      }
    }
    
    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error(`Error fetching task ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Create new task
router.post('/', async (req, res) => {
  try {
    const { title, description, due_date, priority, status, department_id, assignees } = req.body;
    
    // Validate required fields
    if (!title || !description || !due_date) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, description, and due date'
      });
    }
    
    // Create task object with default values
    const task = {
      title,
      description,
      due_date: new Date(due_date).toISOString().split('T')[0], // Format date as YYYY-MM-DD
      priority: priority || 'medium',
      status: status || 'pending',
      department_id,
      created_by: req.user.id,
      created_at: new Date(),
      updated_at: new Date()
    };
    
    // Insert task into database
    const result = await query('INSERT INTO tasks SET ?', task);
    
    // If assignees are provided, create task assignments
    if (assignees && assignees.length > 0) {
      // Create task assignments with assigned_by field
      const assignmentValues = assignees.map(userId => [result.insertId, userId, req.user.id]);
      await query('INSERT INTO task_assignments (task_id, user_id, assigned_by) VALUES ?', [assignmentValues]);
    }
    
    // Log task creation in history
    await query(
      'INSERT INTO task_history (task_id, user_id, action) VALUES (?, ?, ?)',
      [result.insertId, req.user.id, 'Created task']
    );
    
    // Fetch the newly created task with joins
    const [newTask] = await query(`
      SELECT 
        t.*,
        d.name as department_name,
        c.username as created_by_name,
        CONCAT('[', 
          GROUP_CONCAT(
            JSON_OBJECT(
              'user_id', ta.user_id,
              'username', u.username,
              'assigned_at', ta.assigned_at,
              'assigned_by_name', au.username
            )
          ),
        ']') as assignees
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users c ON t.created_by = c.id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      LEFT JOIN users u ON ta.user_id = u.id
      LEFT JOIN users au ON ta.assigned_by = au.id
      WHERE t.id = ?
      GROUP BY t.id
    `, [result.insertId]);
    
    // Format the response data
    if (newTask) {
      // Parse assignees string or set empty array if null
      newTask.assignees = newTask.assignees ? JSON.parse(newTask.assignees) : [];
      
      // Format dates
      newTask.due_date = newTask.due_date ? newTask.due_date.split('T')[0] : null;
      newTask.created_at = newTask.created_at ? newTask.created_at.toString() : null;
      newTask.updated_at = newTask.updated_at ? newTask.updated_at.toString() : null;
    }
    
    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: newTask
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { title, description, due_date, priority, status, department_id } = req.body;
    
    // Check if task exists
    const [task] = await query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check if user is assigned to the task
    const [assignment] = await query(
      'SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?',
      [taskId, req.user.id]
    );
    
    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isCreator = task.created_by === req.user.id;
    const isAssigned = assignment !== undefined;
    
    // Employees can only update tasks they created or are assigned to
    if (req.user.role === 'employee' && !isCreator && !isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this task'
      });
    }
    
    // Build update object with only provided fields
    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (due_date) updateData.due_date = due_date;
    if (priority) updateData.priority = priority;
    
    // Status updates have special rules
    if (status) {
      // Only admins can set completed status directly
      if (status === 'completed' && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Only admins can mark tasks as completed'
        });
      }
      
      // Employees can only change status to in_progress or awaiting_approval
      if (req.user.role === 'employee' && !['in_progress', 'awaiting_approval'].includes(status)) {
        return res.status(403).json({
          success: false,
          message: 'You can only start tasks or request approval'
        });
      }
      
      updateData.status = status;
    }
    
    // Only admins can change department
    if (department_id && isAdmin) {
      updateData.department_id = department_id;
    }
    
    // Add updated timestamp
    updateData.updated_at = new Date();
    
    // Update the task
    await query('UPDATE tasks SET ? WHERE id = ?', [updateData, taskId]);
    
    // Log the update
    await query(
      'INSERT INTO task_history (task_id, user_id, action) VALUES (?, ?, ?)',
      [taskId, req.user.id, 'Updated task details']
    );
    
    // Fetch the updated task with all related information
    const [updatedTask] = await query(`
      SELECT 
        t.*,
        d.name as department_name,
        c.username as created_by_name,
        CONCAT('[', 
          GROUP_CONCAT(
            DISTINCT
            JSON_OBJECT(
              'user_id', ta.user_id,
              'username', u.username,
              'assigned_at', ta.assigned_at,
              'assigned_by_name', au.username
            )
          ),
        ']') as assignees
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users c ON t.created_by = c.id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      LEFT JOIN users u ON ta.user_id = u.id
      LEFT JOIN users au ON ta.assigned_by = au.id
      WHERE t.id = ?
      GROUP BY t.id
    `, [taskId]);
    
    // Parse assignees if present
    if (updatedTask) {
      updatedTask.assignees = updatedTask.assignees ? JSON.parse(updatedTask.assignees) : [];
    }
    
    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask
    });
  } catch (error) {
    console.error(`Error updating task ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Check if task exists
    const [task] = await query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check permissions - only admins, managers, or task creators can delete
    if (req.user.role !== 'admin' && 
        req.user.role !== 'manager' && 
        task.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this task'
      });
    }
    
    // Delete the task
    await query('DELETE FROM tasks WHERE id = ?', [taskId]);
    
    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting task ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update task status
router.put('/:id/status', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    // Check if task exists
    const [task] = await query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check if user is assigned to the task
    const [assignment] = await query(
      'SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?',
      [taskId, req.user.id]
    );
    
    const isAdmin = req.user.role === 'admin';
    const isAssigned = assignment !== undefined;
    
    // Completed status can only be set by admins
    if (status === 'completed' && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can mark tasks as completed'
      });
    }
    
    // Check permissions based on role and status change
    if (req.user.role === 'employee') {
      // Employees can only:
      // 1. Start their assigned tasks (change to in_progress)
      // 2. Request approval (change to awaiting_approval)
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'You can only update tasks assigned to you'
        });
      }
      
      if (!['in_progress', 'awaiting_approval'].includes(status)) {
        return res.status(403).json({
          success: false,
          message: 'You can only start tasks or request approval'
        });
      }
    }
    
    // Update the task status
    await query('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', 
      [status, new Date(), taskId]
    );
    
    // Log the status change
    await query(
      'INSERT INTO task_history (task_id, user_id, action) VALUES (?, ?, ?)',
      [taskId, req.user.id, `Changed status to ${status}`]
    );
    
    // Fetch the updated task with all related information
    const [updatedTask] = await query(`
      SELECT 
        t.*,
        d.name as department_name,
        c.username as created_by_name,
        CONCAT('[', 
          GROUP_CONCAT(
            DISTINCT
            JSON_OBJECT(
              'user_id', ta.user_id,
              'username', u.username,
              'assigned_at', ta.assigned_at,
              'assigned_by_name', au.username
            )
          ),
        ']') as assignees
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users c ON t.created_by = c.id
      LEFT JOIN task_assignments ta ON t.id = ta.task_id
      LEFT JOIN users u ON ta.user_id = u.id
      LEFT JOIN users au ON ta.assigned_by = au.id
      WHERE t.id = ?
      GROUP BY t.id
    `, [taskId]);
    
    // Parse assignees if present
    if (updatedTask) {
      updatedTask.assignees = updatedTask.assignees ? JSON.parse(updatedTask.assignees) : [];
    }
    
    res.status(200).json({
      success: true,
      message: 'Task status updated successfully',
      data: updatedTask
    });
  } catch (error) {
    console.error(`Error updating task status ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Request task completion
router.post('/:id/completion-request', async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Check if task exists
    const [task] = await query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check if user is assigned to the task
    if (task.assigned_to !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only request completion for tasks assigned to you'
      });
    }
    
    // Update task status to awaiting approval
    await query('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', 
      ['awaiting_approval', new Date(), taskId]
    );
    
    // Fetch the updated task
    const [updatedTask] = await query(`
      SELECT t.*, 
        d.name as department_name, 
        u.username as assigned_to_name,
        c.username as created_by_name
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.id = ?
    `, [taskId]);
    
    res.status(200).json({
      success: true,
      message: 'Task completion requested successfully',
      data: updatedTask
    });
  } catch (error) {
    console.error(`Error requesting task completion ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Approve task
router.post('/:id/approve', async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // Only admins can approve tasks
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can approve tasks'
      });
    }
    
    // Check if task exists and is awaiting approval
    const [task] = await query(
      'SELECT * FROM tasks WHERE id = ? AND status = "awaiting_approval"', 
      [taskId]
    );
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or not awaiting approval'
      });
    }
    
    // Update task status to completed
    await query('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', 
      ['completed', new Date(), taskId]
    );
    
    // Fetch the updated task
    const [updatedTask] = await query(`
      SELECT t.*, 
        d.name as department_name, 
        u.username as assigned_to_name,
        c.username as created_by_name
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.id = ?
    `, [taskId]);
    
    res.status(200).json({
      success: true,
      message: 'Task approved successfully',
      data: updatedTask
    });
  } catch (error) {
    console.error(`Error approving task ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Reject task
router.post('/:id/reject', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { feedback } = req.body;
    
    // Only admins can reject tasks
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can reject tasks'
      });
    }
    
    // Check if task exists and is awaiting approval
    const [task] = await query(
      'SELECT * FROM tasks WHERE id = ? AND status = "awaiting_approval"', 
      [taskId]
    );
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or not awaiting approval'
      });
    }
    
    // Update task status back to in_progress with feedback
    const updateData = {
      status: 'in_progress',
      updated_at: new Date()
    };
    
    if (feedback) {
      updateData.feedback = feedback;
    }
    
    await query('UPDATE tasks SET ? WHERE id = ?', [updateData, taskId]);
    
    // Fetch the updated task
    const [updatedTask] = await query(`
      SELECT t.*, 
        d.name as department_name, 
        u.username as assigned_to_name,
        c.username as created_by_name
      FROM tasks t
      LEFT JOIN departments d ON t.department_id = d.id
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN users c ON t.created_by = c.id
      WHERE t.id = ?
    `, [taskId]);
    
    res.status(200).json({
      success: true,
      message: 'Task rejected successfully',
      data: updatedTask
    });
  } catch (error) {
    console.error(`Error rejecting task ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get task assignments
router.get('/:id/assignments', async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // First check if task exists
    const [task] = await query('SELECT id, department_id FROM tasks WHERE id = ?', [taskId]);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check permissions for employees
    if (req.user.role === 'employee') {
      // Get user's assignments for this task
      const [userAssignment] = await query(
        'SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?',
        [taskId, req.user.id]
      );
      
      // Check if user is assigned or in same department
      if (!userAssignment && task.department_id !== req.user.department_id) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view these assignments'
        });
      }
    }
    
    // Fetch assignments with user details
    const assignments = await query(`
      SELECT 
        ta.*,
        u.username,
        u.email,
        u.role,
        d.name as department_name,
        au.username as assigned_by_name
      FROM task_assignments ta
      LEFT JOIN users u ON ta.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN users au ON ta.assigned_by = au.id
      WHERE ta.task_id = ?
      ORDER BY ta.assigned_at DESC
    `, [taskId]);
    
    res.status(200).json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error(`Error fetching task assignments for task ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Add/Update task assignments
router.post('/:id/assignments', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { assignees } = req.body;
    
    if (!assignees || !Array.isArray(assignees)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of assignee IDs'
      });
    }
    
    // Check if task exists
    const [task] = await query('SELECT id, created_by FROM tasks WHERE id = ?', [taskId]);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check permissions
    if (req.user.role !== 'admin' && task.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify task assignments'
      });
    }
    
    // Start transaction
    await query('START TRANSACTION');
    
    try {
      // Remove existing assignments
      await query('DELETE FROM task_assignments WHERE task_id = ?', [taskId]);
      
      // Add new assignments
      if (assignees.length > 0) {
        const assignmentValues = assignees.map(userId => [taskId, userId, req.user.id]);
        await query(
          'INSERT INTO task_assignments (task_id, user_id, assigned_by) VALUES ?',
          [assignmentValues]
        );
      }
      
      // Commit transaction
      await query('COMMIT');
      
      // Fetch updated assignments
      const assignments = await query(`
        SELECT 
          ta.*,
          u.username,
          u.email,
          u.role,
          d.name as department_name,
          au.username as assigned_by_name
        FROM task_assignments ta
        LEFT JOIN users u ON ta.user_id = u.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN users au ON ta.assigned_by = au.id
        WHERE ta.task_id = ?
        ORDER BY ta.assigned_at DESC
      `, [taskId]);
      
      res.status(200).json({
        success: true,
        message: 'Task assignments updated successfully',
        data: assignments
      });
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error(`Error updating task assignments for task ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Remove specific assignment
router.delete('/:taskId/assignments/:userId', async (req, res) => {
  try {
    const { taskId, userId } = req.params;
    
    // Check if task and assignment exist
    const [task] = await query('SELECT id, created_by FROM tasks WHERE id = ?', [taskId]);
    const [assignment] = await query(
      'SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?',
      [taskId, userId]
    );
    
    if (!task || !assignment) {
      return res.status(404).json({
        success: false,
        message: 'Task or assignment not found'
      });
    }
    
    // Check permissions
    if (req.user.role !== 'admin' && task.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to remove task assignments'
      });
    }
    
    // Remove the assignment
    await query(
      'DELETE FROM task_assignments WHERE task_id = ? AND user_id = ?',
      [taskId, userId]
    );
    
    res.status(200).json({
      success: true,
      message: 'Assignment removed successfully'
    });
  } catch (error) {
    console.error(`Error removing assignment for task ${req.params.taskId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get task comments
router.get('/:id/comments', async (req, res) => {
  try {
    const taskId = req.params.id;
    
    // First check if task exists
    const [task] = await query('SELECT id, department_id FROM tasks WHERE id = ?', [taskId]);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // Check permissions for employees
    if (req.user.role === 'employee') {
      // Get user's assignment for this task
      const [userAssignment] = await query(
        'SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?',
        [taskId, req.user.id]
      );
      
      // Check if user is assigned or in same department
      if (!userAssignment && task.department_id !== req.user.department_id) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to view these comments'
        });
      }
    }
    
    // Fetch comments with user details
    const comments = await query(`
      SELECT 
        tc.*,
        u.username,
        u.role,
        d.name as department_name,
        CASE 
          WHEN tc.user_id = ? THEN true 
          ELSE false 
        END as is_own_comment
      FROM task_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at DESC
    `, [req.user.id, taskId]);
    
    // Format comments for frontend
    const formattedComments = comments.map(comment => ({
      id: comment.id,
      taskId: comment.task_id,
      userId: comment.user_id,
      comment: comment.comment,
      createdAt: comment.created_at,
      username: comment.username,
      userRole: comment.role,
      departmentName: comment.department_name,
      isOwnComment: comment.is_own_comment
    }));
    
    res.status(200).json({
      success: true,
      data: formattedComments
    });
  } catch (error) {
    console.error(`Error fetching comments for task ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Add comment to task
router.post('/:id/comments', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { comment } = req.body;
    
    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Comment text is required'
      });
    }
    
    // Check if task exists and user has access
    const [task] = await query('SELECT id, department_id FROM tasks WHERE id = ?', [taskId]);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // For employees, check if they're assigned or in the same department
    if (req.user.role === 'employee') {
      const [userAssignment] = await query(
        'SELECT * FROM task_assignments WHERE task_id = ? AND user_id = ?',
        [taskId, req.user.id]
      );
      
      if (!userAssignment && task.department_id !== req.user.department_id) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to comment on this task'
        });
      }
    }
    
    // Create comment
    const commentData = {
      task_id: taskId,
      user_id: req.user.id,
      comment: comment.trim()
    };
    
    const result = await query('INSERT INTO task_comments SET ?', commentData);
    
    // Fetch the newly created comment with user details
    const [newComment] = await query(`
      SELECT 
        tc.*,
        u.username,
        u.role,
        d.name as department_name,
        true as is_own_comment
      FROM task_comments tc
      LEFT JOIN users u ON tc.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE tc.id = ?
    `, [result.insertId]);
    
    // Format comment for frontend
    const formattedComment = {
      id: newComment.id,
      taskId: newComment.task_id,
      userId: newComment.user_id,
      comment: newComment.comment,
      createdAt: newComment.created_at,
      username: newComment.username,
      userRole: newComment.role,
      departmentName: newComment.department_name,
      isOwnComment: true
    };
    
    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: formattedComment
    });
  } catch (error) {
    console.error(`Error adding comment to task ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete comment
router.delete('/:taskId/comments/:commentId', async (req, res) => {
  try {
    const { taskId, commentId } = req.params;
    
    // Check if comment exists
    const [comment] = await query(
      'SELECT * FROM task_comments WHERE id = ? AND task_id = ?',
      [commentId, taskId]
    );
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }
    
    // Only comment owner or admin can delete
    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this comment'
      });
    }
    
    // Delete comment
    await query('DELETE FROM task_comments WHERE id = ?', [commentId]);
    
    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting comment ${req.params.commentId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router; 