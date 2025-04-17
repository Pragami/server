require('dotenv').config();
const db = require('./config/database');
const util = require('util');
const query = util.promisify(db.query).bind(db);

async function checkTables() {
    try {
        console.log('Checking database tables...\n');

        // Check user 18
        console.log('1. Checking user 18:');
        const [user] = await query('SELECT * FROM users WHERE id = ?', [18]);
        console.log(user);
        console.log('\n');

        // Check department for user 18
        console.log('2. Checking department:');
        const [dept] = await query('SELECT * FROM departments WHERE id = ?', [user.department_id]);
        console.log(dept);
        console.log('\n');

        // Check tasks for user 18
        console.log('3. Checking tasks:');
        const tasks = await query('SELECT * FROM tasks WHERE assigned_to = ? LIMIT 5', [18]);
        console.log(`Found ${tasks.length} tasks. First 5 tasks:`);
        console.log(tasks);
        console.log('\n');

        // Check table structures
        console.log('4. Checking table structures:');
        const tables = ['users', 'departments', 'tasks'];
        for (const table of tables) {
            const [fields] = await query('DESCRIBE ??', [table]);
            console.log(`\n${table} table structure:`);
            console.log(fields);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkTables(); 