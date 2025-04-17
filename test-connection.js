const db = require('./config/database');
const util = require('util');
const query = util.promisify(db.query).bind(db);

async function testConnection() {
    try {
        // Test basic connection
        console.log('Testing database connection...');
        
        // Test the employees analytics query using the correct schema
        const employeesQuery = `
            SELECT 
                u.id, u.username, u.email, u.role, u.department_id,
                d.name as department_name,
                COUNT(DISTINCT t.id) as total_tasks,
                COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
                COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
                COUNT(DISTINCT CASE WHEN t.status = 'pending' THEN t.id END) as pending_tasks
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN task_assignments ta ON ta.user_id = u.id
            LEFT JOIN tasks t ON t.id = ta.task_id AND t.is_deleted = 0
            GROUP BY u.id
        `;
        
        console.log('Executing analytics query...');
        const employees = await query(employeesQuery);
        console.log('Query successful. Found', employees.length, 'employees');
        console.log('Sample employee data:', employees[0]);

    } catch (error) {
        console.error('Database Error:', error);
    } finally {
        process.exit();
    }
}

testConnection(); 