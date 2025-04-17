require('dotenv').config();
const db = require('./config/database');
const util = require('util');
const query = util.promisify(db.query).bind(db);

async function checkDepartment() {
    try {
        console.log('Checking department 13 data:\n');

        // Check if department exists
        const [dept] = await query('SELECT * FROM departments WHERE id = ?', [13]);
        console.log('1. Department data:', dept || 'Not found');
        console.log('\n');

        if (dept) {
            // Check tasks in this department
            const tasks = await query(`
                SELECT t.*, u.username as creator_name 
                FROM tasks t 
                LEFT JOIN users u ON t.created_by = u.id 
                WHERE t.department_id = ? 
                LIMIT 5
            `, [13]);
            console.log('2. Sample tasks:', tasks);
            console.log('\n');

            // Check employees in this department
            const employees = await query('SELECT * FROM users WHERE department_id = ?', [13]);
            console.log('3. Department employees:', employees);
            console.log('\n');

            // Get task statistics
            const [taskStats] = await query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                    COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
                FROM tasks 
                WHERE department_id = ?
            `, [13]);
            console.log('4. Task statistics:', taskStats);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkDepartment(); 