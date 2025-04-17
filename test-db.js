require('dotenv').config();
const db = require('./config/database');
const util = require('util');
const query = util.promisify(db.query).bind(db);

async function testConnection() {
    try {
        // Test basic connection
        console.log('Testing database connection...');
        console.log('Using configuration:', {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: process.env.DB_NAME
        });

        // Try to query employee 18
        const [employee] = await query('SELECT * FROM users WHERE id = ?', [18]);
        console.log('Employee 18 data:', employee);

    } catch (error) {
        console.error('Database Error:', error);
    } finally {
        process.exit();
    }
}

testConnection(); 