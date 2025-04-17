require('dotenv').config();
const db = require('./config/database');
const util = require('util');
const query = util.promisify(db.query).bind(db);

async function checkTasksTable() {
    try {
        console.log('Checking tasks table structure:\n');
        
        // Get table structure
        const [fields] = await query('SHOW CREATE TABLE tasks');
        console.log('Table Creation SQL:');
        console.log(fields['Create Table']);
        
        // Get a sample task
        console.log('\nSample task:');
        const [sampleTask] = await query('SELECT * FROM tasks LIMIT 1');
        console.log(sampleTask);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkTasksTable(); 