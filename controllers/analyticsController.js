const db = require('../config/database');
const util = require('util');

// Convert db.query to use promises
const query = util.promisify(db.query).bind(db);

// Get analytics for all departments
exports.getDepartmentAnalytics = async (req, res) => {
  try {
    // Get all departments with task counts
    const departmentsQuery = `
      SELECT d.*, COUNT(t.id) as task_count
      FROM departments d
      LEFT JOIN tasks t ON t.department_id = d.id
      GROUP BY d.id
    `;
    
    const departments = await query(departmentsQuery);
    
    // Success response
    res.status(200).json({
      success: true,
      data: departments
    });
  } catch (error) {
    console.error('Error fetching department analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department analytics',
      error: error.message
    });
  }
};

// Get analytics for specific department
exports.getDepartmentDetails = async (req, res) => {
  try {
    const departmentId = req.params.id;
    
    // Get department details
    const departmentQuery = `SELECT * FROM departments WHERE id = ?`;
    const [department] = await query(departmentQuery, [departmentId]);
    
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    
    // Get task counts by status
    const taskStatsQuery = `
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN status = 'awaiting_approval' THEN 1 END) as awaiting_approval_tasks,
        COUNT(*) as total_tasks
      FROM tasks
      WHERE department_id = ? AND is_deleted = 0
    `;
    
    const [taskStats] = await query(taskStatsQuery, [departmentId]);
    
    // Get employee count for department
    const employeeCountQuery = `
      SELECT COUNT(*) as employee_count
      FROM users
      WHERE department_id = ?
    `;
    
    const [employeeCount] = await query(employeeCountQuery, [departmentId]);
    
    // Get monthly completion rate for past 6 months
    const monthlyDataQuery = `
      SELECT 
        DATE_FORMAT(updated_at, '%b %Y') as period,
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END) / COUNT(*)) * 100) as completion_rate,
        ROUND((COUNT(CASE WHEN status = 'completed' AND updated_at <= due_date THEN 1 END) / 
               NULLIF(COUNT(CASE WHEN status = 'completed' THEN 1 END), 0)) * 100) as on_time_rate,
        ROUND(AVG(CASE WHEN status = 'completed' THEN 
          CASE priority 
            WHEN 'urgent' THEN 4 
            WHEN 'high' THEN 3 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 1 
            ELSE 2 
          END 
        END)) as avg_priority
      FROM tasks
      WHERE department_id = ? AND is_deleted = 0
        AND updated_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY period
      ORDER BY MIN(updated_at)
    `;
    
    const monthlyData = await query(monthlyDataQuery, [departmentId]);
    
    // Get tasks for the department
    const tasksQuery = `
      SELECT t.*, u.username as creator_name
      FROM tasks t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.department_id = ? AND t.is_deleted = 0
      ORDER BY t.due_date DESC
      LIMIT 100
    `;
    
    const tasks = await query(tasksQuery, [departmentId]);
    
    // Success response with combined data
    res.status(200).json({
      success: true,
      data: {
        id: department.id,
        name: department.name,
        description: department.description,
        employeeCount: employeeCount.employee_count,
        totalTasks: taskStats.total_tasks,
        completedTasks: taskStats.completed_tasks,
        inProgressTasks: taskStats.in_progress_tasks,
        pendingTasks: taskStats.pending_tasks,
        awaitingApprovalTasks: taskStats.awaiting_approval_tasks,
        completionRate: taskStats.total_tasks > 0 
          ? Math.round((taskStats.completed_tasks / taskStats.total_tasks) * 100) 
          : 0,
        monthlyData: monthlyData.map(month => ({
          period: month.period,
          completionRate: month.completion_rate || 0,
          onTimeRate: month.on_time_rate || 0,
          qualityScore: Math.min(100, (month.avg_priority || 0) * 20) // Convert priority to score
        })),
        tasks: tasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.due_date,
          createdBy: task.created_by,
          creatorName: task.creator_name,
          createdAt: task.created_at,
          updatedAt: task.updated_at
        }))
      }
    });
  } catch (error) {
    console.error(`Error fetching department ${req.params.id} details:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch department details',
      error: error.message
    });
  }
};

// Get analytics for employees
exports.getEmployeeAnalytics = async (req, res) => {
  try {
    // Get all employees with task counts
    const employeesQuery = `
      SELECT 
        u.id, u.username, u.email, u.role, u.department_id,
        d.name as department_name,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'pending' THEN t.id END) as pending_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'awaiting_approval' THEN t.id END) as awaiting_approval_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' AND t.updated_at <= t.due_date THEN t.id END) as on_time_completions,
        COUNT(DISTINCT CASE WHEN DATE(t.due_date) < DATE(NOW()) AND t.status != 'completed' THEN t.id END) as overdue_tasks
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN task_assignments ta ON ta.user_id = u.id
      LEFT JOIN tasks t ON t.id = ta.task_id AND t.is_deleted = 0
      GROUP BY u.id
    `;
    
    const employees = await query(employeesQuery);
    
    // Calculate performance metrics for each employee
    const employeesWithMetrics = employees.map(employee => {
      const totalCompleted = employee.completed_tasks || 0;
      const totalTasks = employee.total_tasks || 0;
      const onTimeCompletions = employee.on_time_completions || 0;
      
      // Calculate performance score (weighted average of completion rate and on-time rate)
      const completionRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;
      const onTimeRate = totalCompleted > 0 ? (onTimeCompletions / totalCompleted) * 100 : 0;
      const performance = Math.round((completionRate * 0.6) + (onTimeRate * 0.4));
      
      return {
        ...employee,
        completed: employee.completed_tasks,
        inProgress: employee.in_progress_tasks,
        overdue: employee.overdue_tasks || 0,
        completionRate: Math.round(completionRate),
        onTimeRate: Math.round(onTimeRate),
        performance,
        status: 'active'
      };
    });
    
    // Success response
    res.status(200).json({
      success: true,
      data: employeesWithMetrics
    });
  } catch (error) {
    console.error('Error fetching employee analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee analytics',
      error: error.message
    });
  }
};

// Get analytics for specific employee
exports.getEmployeeDetails = async (req, res) => {
  try {
    const employeeId = req.params.id;
    
    // Get employee details
    const employeeQuery = `
      SELECT u.*, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `;
    
    const [employee] = await query(employeeQuery, [employeeId]);
    
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }
    
    // Get task counts by status for assigned tasks
    const taskStatsQuery = `
      SELECT 
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'pending' THEN t.id END) as pending_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'awaiting_approval' THEN t.id END) as awaiting_approval_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' AND t.updated_at <= t.due_date THEN t.id END) as on_time_completions
      FROM task_assignments ta
      JOIN tasks t ON t.id = ta.task_id AND t.is_deleted = 0
      WHERE ta.user_id = ?
    `;
    
    const [taskStats] = await query(taskStatsQuery, [employeeId]);
    
    // Get weekly completion data for past 12 weeks
    const weeklyDataQuery = `
      SELECT 
        CONCAT(
          DATE_FORMAT(DATE_SUB(t.updated_at, INTERVAL WEEKDAY(t.updated_at) DAY), '%b %d'), 
          ' - ', 
          DATE_FORMAT(DATE_ADD(DATE_SUB(t.updated_at, INTERVAL WEEKDAY(t.updated_at) DAY), INTERVAL 6 DAY), '%b %d')
        ) as period,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        ROUND((COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) / COUNT(DISTINCT t.id)) * 100) as completion_rate,
        ROUND((COUNT(DISTINCT CASE WHEN t.status = 'completed' AND t.updated_at <= t.due_date THEN t.id END) / 
               NULLIF(COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END), 0)) * 100) as on_time_rate,
        ROUND(AVG(CASE WHEN t.status = 'completed' THEN 
          CASE t.priority 
            WHEN 'urgent' THEN 4 
            WHEN 'high' THEN 3 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 1 
            ELSE 2 
          END 
        END)) as avg_priority
      FROM task_assignments ta
      JOIN tasks t ON t.id = ta.task_id AND t.is_deleted = 0
      WHERE ta.user_id = ?
        AND t.updated_at >= DATE_SUB(NOW(), INTERVAL 12 WEEK)
      GROUP BY period
      ORDER BY MIN(t.updated_at)
    `;
    
    const weeklyData = await query(weeklyDataQuery, [employeeId]);
    
    // Get tasks for the employee
    const tasksQuery = `
      SELECT t.*, d.name as department_name
      FROM task_assignments ta
      JOIN tasks t ON t.id = ta.task_id AND t.is_deleted = 0
      LEFT JOIN departments d ON t.department_id = d.id
      WHERE ta.user_id = ?
      ORDER BY t.due_date DESC
      LIMIT 100
    `;
    
    const tasks = await query(tasksQuery, [employeeId]);
    
    // Calculate performance metrics
    const totalCompleted = taskStats.completed_tasks || 0;
    const totalTasks = taskStats.total_tasks || 0;
    const onTimeCompletions = taskStats.on_time_completions || 0;
    
    const completionRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;
    const onTimeRate = totalCompleted > 0 ? (onTimeCompletions / totalCompleted) * 100 : 0;
    const performance = Math.round((completionRate * 0.6) + (onTimeRate * 0.4));
    
    // Success response with combined data
    res.status(200).json({
      success: true,
      data: {
        id: employee.id,
        username: employee.username,
        email: employee.email,
        role: employee.role,
        department_id: employee.department_id,
        department_name: employee.department_name,
        totalTasks: taskStats.total_tasks || 0,
        completed: taskStats.completed_tasks || 0,
        inProgress: taskStats.in_progress_tasks || 0,
        pending: taskStats.pending_tasks || 0,
        awaiting: taskStats.awaiting_approval_tasks || 0,
        overdue: Math.max(0, totalTasks - totalCompleted - taskStats.in_progress_tasks - taskStats.pending_tasks),
        completionRate: Math.round(completionRate),
        onTimeRate: Math.round(onTimeRate),
        performance,
        weeklyData: weeklyData.map(week => ({
          period: week.period,
          completionRate: week.completion_rate || 0,
          onTimeRate: week.on_time_rate || 0,
          qualityScore: Math.min(100, (week.avg_priority || 0) * 20) // Convert priority to score
        })),
        tasks
      }
    });
  } catch (error) {
    console.error(`Error fetching employee ${req.params.id} details:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch employee details',
      error: error.message
    });
  }
};

// Get performance analytics dashboard data
exports.getPerformanceAnalytics = async (req, res) => {
  try {
    // Get all departments
    const departmentsQuery = `
      SELECT d.*, COUNT(t.id) as task_count
      FROM departments d
      LEFT JOIN tasks t ON t.department_id = d.id
      GROUP BY d.id
    `;
    
    const departments = await query(departmentsQuery);
    
    // Get all employees with task metrics
    const employeesQuery = `
      SELECT 
        u.id, u.username, u.email, u.role, u.department_id,
        d.name as department_name,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' AND t.updated_at <= t.due_date THEN t.id END) as on_time_completions
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN task_assignments ta ON ta.user_id = u.id
      LEFT JOIN tasks t ON t.id = ta.task_id
      GROUP BY u.id
    `;
    
    const employees = await query(employeesQuery);
    
    // Get department level metrics
    const departmentDataPromises = departments.map(async (dept) => {
      // Get monthly data for department
      const monthlyDataQuery = `
        SELECT 
          DATE_FORMAT(updated_at, '%b %Y') as period,
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
          ROUND((COUNT(CASE WHEN status = 'completed' THEN 1 END) / COUNT(*)) * 100) as completion_rate,
          ROUND((COUNT(CASE WHEN status = 'completed' AND updated_at <= due_date THEN 1 END) / 
                NULLIF(COUNT(CASE WHEN status = 'completed' THEN 1 END), 0)) * 100) as on_time_rate,
          ROUND(AVG(CASE WHEN status = 'completed' THEN IFNULL(priority, 3) END)) as avg_priority
        FROM tasks
        WHERE department_id = ? 
          AND updated_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY period
        ORDER BY MIN(updated_at)
      `;
      
      const monthlyData = await query(monthlyDataQuery, [dept.id]);
      
      // Get task stats
      const taskStatsQuery = `
        SELECT 
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
          COUNT(CASE WHEN status = 'todo' THEN 1 END) as pending_tasks,
          COUNT(*) as total_tasks
        FROM tasks
        WHERE department_id = ?
      `;
      
      const [taskStats] = await query(taskStatsQuery, [dept.id]);
      
      // Get employee count
      const deptEmployees = employees.filter(e => e.department_id === dept.id);
      
      // Calculate overall completion rate
      const completionRate = taskStats.total_tasks > 0 
        ? Math.round((taskStats.completed_tasks / taskStats.total_tasks) * 100) 
        : 0;
      
      return {
        id: dept.id,
        name: dept.name,
        description: dept.description,
        color: dept.color || '#4e73df',
        employeeCount: deptEmployees.length,
        totalTasks: taskStats.total_tasks,
        completedTasks: taskStats.completed_tasks,
        inProgressTasks: taskStats.in_progress_tasks,
        pendingTasks: taskStats.pending_tasks,
        completionRate,
        monthlyData: monthlyData.map(month => ({
          period: month.period,
          completionRate: month.completion_rate || 0,
          onTimeRate: month.on_time_rate || 0,
          qualityScore: Math.min(100, (month.avg_priority || 0) * 20) // Convert priority to score
        })),
        projects: [{
          label: `${dept.name} Projects`,
          percentage: completionRate,
          variant: completionRate >= 70 ? 'success' : completionRate >= 40 ? 'warning' : 'danger',
          description: `${completionRate}% of tasks completed`
        }]
      };
    });
    
    const departmentData = await Promise.all(departmentDataPromises);
    
    // Process employees to add performance metrics
    const employeesWithMetrics = employees.map(employee => {
      const totalCompleted = employee.completed_tasks || 0;
      const totalTasks = employee.total_tasks || 0;
      const onTimeCompletions = employee.on_time_completions || 0;
      
      // Calculate performance score (weighted average of completion rate and on-time rate)
      const completionRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;
      const onTimeRate = totalCompleted > 0 ? (onTimeCompletions / totalCompleted) * 100 : 0;
      const performance = Math.round((completionRate * 0.6) + (onTimeRate * 0.4));
      
      return {
        ...employee,
        completed: employee.completed_tasks,
        inProgress: employee.in_progress_tasks,
        overdue: Math.max(0, totalTasks - totalCompleted - employee.in_progress_tasks),
        completionRate: Math.round(completionRate),
        onTimeRate: Math.round(onTimeRate),
        performance,
        status: 'active'
      };
    });
    
    // Get overall system metrics
    const systemStatsQuery = `
      SELECT 
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT d.id) as total_departments
      FROM tasks t
      CROSS JOIN users u
      CROSS JOIN departments d
      LIMIT 1
    `;
    
    const [systemStats] = await query(systemStatsQuery);
    
    // Success response with combined data
    res.status(200).json({
      success: true,
      data: {
        departments,
        employees: employeesWithMetrics,
        departmentData,
        systemStats: {
          totalTasks: systemStats.total_tasks,
          completedTasks: systemStats.completed_tasks,
          inProgressTasks: systemStats.in_progress_tasks,
          totalUsers: systemStats.total_users,
          totalDepartments: systemStats.total_departments
        }
      }
    });
  } catch (error) {
    console.error('Error fetching performance analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch performance analytics',
      error: error.message
    });
  }
};

// Get company-wide analytics
exports.getCompanyAnalytics = async (req, res) => {
  try {
    const timeRange = req.query.timeRange || 'month';
    
    // Define the date range based on the timeRange parameter
    let dateRangeQuery;
    switch (timeRange) {
      case 'week':
        dateRangeQuery = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
        break;
      case 'month':
        dateRangeQuery = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        break;
      case 'quarter':
        dateRangeQuery = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)';
        break;
      case 'year':
        dateRangeQuery = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
        break;
      default:
        dateRangeQuery = 'AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
    }
    
    // Task status distribution
    const taskStatusQuery = `
      SELECT 
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as Completed,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as 'In Progress',
        COUNT(CASE WHEN status = 'todo' THEN 1 END) as Pending,
        COUNT(CASE WHEN DATE(due_date) < DATE(NOW()) AND status != 'completed' THEN 1 END) as Overdue
      FROM tasks
      WHERE 1=1 ${dateRangeQuery}
    `;
    
    // Priority distribution
    const priorityDistributionQuery = `
      SELECT 
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as High,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as Medium,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as Low
      FROM tasks
      WHERE 1=1 ${dateRangeQuery}
    `;
    
    // Task trend (created vs completed tasks by month)
    const taskTrendQuery = `
      SELECT 
        DATE_FORMAT(created_at, '%b') as month,
        COUNT(*) as created_count
      FROM tasks
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY MIN(created_at)
    `;
    
    const completedTaskTrendQuery = `
      SELECT 
        DATE_FORMAT(updated_at, '%b') as month,
        COUNT(*) as completed_count
      FROM tasks
      WHERE status = 'completed' 
        AND updated_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY MIN(updated_at)
    `;
    
    // Department performance
    const departmentPerformanceQuery = `
      SELECT 
        d.name,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        ROUND(COUNT(CASE WHEN t.status = 'completed' THEN 1 END) / COUNT(t.id) * 100) as completion_rate
      FROM departments d
      LEFT JOIN tasks t ON t.department_id = d.id
      WHERE 1=1 ${dateRangeQuery}
      GROUP BY d.id
      ORDER BY completion_rate DESC
    `;
    
    // Statistics
    const statisticsQuery = `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'todo' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN DATE(due_date) < DATE(NOW()) AND status != 'completed' THEN 1 END) as overdue_tasks,
        AVG(CASE 
            WHEN status = 'completed' THEN 
              TIMESTAMPDIFF(DAY, created_at, updated_at)
            ELSE NULL
          END) as avg_completion_days
      FROM tasks
      WHERE 1=1 ${dateRangeQuery}
    `;
    
    // Execute all queries
    const [taskStatus] = await query(taskStatusQuery);
    const [priorityDistribution] = await query(priorityDistributionQuery);
    const taskTrend = await query(taskTrendQuery);
    const completedTaskTrend = await query(completedTaskTrendQuery);
    const departmentPerformance = await query(departmentPerformanceQuery);
    const [statistics] = await query(statisticsQuery);
    
    // Merge task trend data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const last6Months = [];
    const createdTasks = [];
    const completedTasks = [];
    
    // Get the last 6 months
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today);
      d.setMonth(today.getMonth() - i);
      last6Months.push(months[d.getMonth()]);
    }
    
    // Map created tasks to months
    last6Months.forEach(month => {
      const found = taskTrend.find(item => item.month === month);
      createdTasks.push(found ? found.created_count : 0);
      
      const foundCompleted = completedTaskTrend.find(item => item.month === month);
      completedTasks.push(foundCompleted ? foundCompleted.completed_count : 0);
    });
    
    // Map department performance
    const departmentLabels = departmentPerformance.map(dept => dept.name);
    const completionRates = departmentPerformance.map(dept => dept.completion_rate || 0);
    
    // Format statistics
    const avgCompletionTime = statistics.avg_completion_days 
      ? `${statistics.avg_completion_days.toFixed(1)} days` 
      : 'N/A';
    
    const completionRate = statistics.total_tasks > 0 
      ? `${Math.round((statistics.completed_tasks / statistics.total_tasks) * 100)}%`
      : '0%';
    
    // Construct response object
    const response = {
      taskStatusDistribution: taskStatus,
      priorityDistribution: priorityDistribution,
      taskTrend: {
        labels: last6Months,
        createdTasks,
        completedTasks
      },
      departmentPerformance: {
        labels: departmentLabels,
        completionRates
      },
      statistics: {
        totalTasks: statistics.total_tasks || 0,
        completedTasks: statistics.completed_tasks || 0,
        pendingTasks: statistics.pending_tasks || 0,
        overdueTasks: statistics.overdue_tasks || 0,
        averageCompletionTime: avgCompletionTime,
        completionRate: completionRate
      }
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching company analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company analytics data',
      error: error.message
    });
  }
}; 