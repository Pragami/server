# Task Manager Backend

A robust Node.js backend for the Task Manager application with user authentication, task management, and department organization features.

## Technologies Used

- Node.js
- Express.js
- MySQL
- JWT Authentication
- CORS enabled

## Prerequisites

- Node.js >= 14.0.0
- MySQL Database

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
NODE_ENV=development
PORT=5000
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=your_database_name
DB_PORT=3306
JWT_SECRET=your_jwt_secret_key
DEBUG=true
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Pragami/backend.git
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables as described above

4. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- POST `/api/auth/login` - User login
- POST `/api/auth/register` - User registration

### Users
- GET `/api/users` - Get all users
- GET `/api/users/:id` - Get user by ID
- PUT `/api/users/:id` - Update user
- DELETE `/api/users/:id` - Delete user

### Tasks
- GET `/api/tasks` - Get all tasks
- POST `/api/tasks` - Create new task
- GET `/api/tasks/:id` - Get task by ID
- PUT `/api/tasks/:id` - Update task
- DELETE `/api/tasks/:id` - Delete task

### Departments
- GET `/api/departments` - Get all departments
- POST `/api/departments` - Create new department
- GET `/api/departments/:id` - Get department by ID
- PUT `/api/departments/:id` - Update department
- DELETE `/api/departments/:id` - Delete department

## Deployment

This application is configured for deployment on Railway. See the Procfile for deployment configuration.

## License

MIT 