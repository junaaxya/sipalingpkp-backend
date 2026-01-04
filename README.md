# Sipaling PKP Backend

A Node.js backend application built with Express.js, MySQL database, and Sequelize ORM.

## 🚀 Features

- **Express.js** - Fast, unopinionated web framework
- **MySQL** - Relational database
- **Sequelize** - Promise-based ORM for Node.js
- **Migrations** - Database schema versioning
- **Environment Configuration** - Secure configuration management
- **CORS Support** - Cross-origin resource sharing
- **Security Middleware** - Helmet for security headers
- **Logging** - Morgan HTTP request logger
- **Error Handling** - Comprehensive error handling middleware
- **ESLint** - Code linting and formatting with Airbnb style guide
- **nanoid** - URL-safe, unique string ID generator for database records

## 📋 Prerequisites

- Node.js (v20 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sipaling-pkp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your database credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=sipaling_pkp_dev
   DB_USERNAME=root
   DB_PASSWORD=your_password_here
   ```

4. **Database Setup**
   ```bash
   # Create the database
   mysql -u root -p -e "CREATE DATABASE sipaling_pkp_dev;"
   
   # Run migrations
   npm run db:migrate
   ```

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:8000` (or the port specified in your `.env` file).

## 📚 API Endpoints

### Health Check
- `GET /health` - Server health status

### API Info
- `GET /api` - API information and available endpoints

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID (nanoid format: e.g., `zTZTHRgY81uN`)
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## 🗄️ Database Commands

### Migrations
```bash
# Run migrations
npm run db:migrate

# Undo last migration
npm run db:migrate:undo

# Create new migration
npx sequelize-cli migration:generate --name migration-name

# Create new model with migration
npx sequelize-cli model:generate --name ModelName --attributes field1:type,field2:type
```

### Seeders
```bash
# Run all seeders
npm run db:seed

# Undo all seeders
npm run db:seed:undo

# Create new seeder
npx sequelize-cli seed:generate --name seeder-name
```

## 📁 Project Structure

```
sipaling-pkp/
├── src/
│   ├── config/
│   │   ├── database.js          # Database configuration
│   │   └── nanoid.js           # nanoid ID generator configuration
│   ├── controllers/
│   │   └── userController.js    # User controller
│   ├── middleware/              # Custom middleware
│   ├── models/                  # Sequelize models
│   │   ├── index.js            # Models index
│   │   ├── user.js             # User model
│   │   ├── role.js             # Role model
│   │   └── ...                 # Other models
│   ├── routes/
│   │   └── userRoutes.js       # User routes
│   ├── utils/                  # Utility functions
│   └── app.js                  # Main application file
├── migrations/                 # Database migrations
├── seeders/                   # Database seeders
├── config/
│   └── config.json           # Sequelize CLI configuration
├── .env.example              # Environment variables template
├── .eslintrc.js             # ESLint configuration
├── .eslintignore            # ESLint ignore rules
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies and scripts
└── README.md               # This file
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8000` |
| `NODE_ENV` | Environment | `development` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `3306` |
| `DB_NAME` | Database name | `sipaling_pkp` |
| `DB_USERNAME` | Database user | `root` |
| `DB_PASSWORD` | Database password | - |
| `CORS_ORIGIN` | CORS origin | `http://localhost:8000` |

## 🧪 Testing & Code Quality

### ESLint
```bash
# Check for linting errors
npm run lint

# Fix auto-fixable linting errors
npm run lint:fix

# Check for linting errors (strict mode - no warnings allowed)
npm run lint:check
```

### Testing
```bash
# Run tests (when implemented)
npm test
```

## 🆔 ID Generation with nanoid

This project uses **nanoid** for generating unique, URL-safe identifiers instead of auto-incrementing integers. This provides several benefits:

- **URL-safe**: IDs can be safely used in URLs without encoding
- **Collision-resistant**: Extremely low probability of ID collisions
- **Shorter**: 12-character IDs vs longer UUIDs
- **Readable**: Uses alphanumeric characters (0-9, A-Z, a-z)

### nanoid Configuration

The project includes several nanoid generators in `src/config/nanoid.js`:

```javascript
const { generateId, generateUrlSafeId, generateNumericId } = require('./src/config/nanoid');

// Basic nanoid (default: 12 characters)
const id = generateId(); // e.g., "zTZTHRgY81uN"

// URL-safe nanoid (includes - and _)
const urlId = generateUrlSafeId(); // e.g., "hnwVoH0WwtkY"

// Numeric-only nanoid
const numericId = generateNumericId(); // e.g., "4hFJWe49rDgE"
```

### Using nanoid in Models

All models automatically generate nanoid IDs:

```javascript
// User model automatically gets nanoid ID
const user = await User.create({
  fullName: 'John Doe',
  email: 'john@example.com',
  password: 'password123'
});
// user.id will be something like "zTZTHRgY81uN"
```

## 📝 Development

### Adding New Models

1. Generate model with migration:
   ```bash
   npx sequelize-cli model:generate --name ModelName --attributes field1:type,field2:type
   ```

2. Update the migration file with proper constraints
3. Update the model file with validations
4. Run migration:
   ```bash
   npm run db:migrate
   ```

### Adding New Routes

1. Create controller in `src/controllers/`
2. Create routes in `src/routes/`
3. Import and use routes in `src/app.js`

## 🚀 Deployment

1. Set `NODE_ENV=production` in your environment
2. Update database credentials for production
3. Run migrations on production database
4. Start the application with `npm start`

## 📄 License

This project is licensed under the ISC License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support, please open an issue in the repository or contact the development team.