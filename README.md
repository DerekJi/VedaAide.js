# VedaAide.js

An intelligent AI-powered application built with Next.js and LangChain for document processing, vector embeddings, and context-aware question answering.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Building](#building)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## ✨ Features

- **AI-Powered Processing**: Integration with LangChain and OpenAI for intelligent document processing
- **Vector Embeddings**: Store and search document chunks with vector embeddings
- **Modern UI**: Built with Next.js 15 and React 19 with Radix UI components
- **Type-Safe**: Full TypeScript support for robust development
- **Database Integration**: Prisma ORM for seamless database management
- **API Routes**: RESTful API built on Next.js App Router
- **Testing**: Comprehensive test coverage with Vitest and Playwright E2E tests
- **Code Quality**: ESLint, Prettier for code standards
- **Error Handling**: Built-in error boundaries and logging with Pino

## 📦 Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher (or yarn/pnpm equivalent)
- **Database**: SQLite (default) or configure your own
- **Git**: For version control

### Optional

- **Docker**: For containerized deployment
- **Docker Compose**: For orchestrating multiple services

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/VedaAide.js.git
cd VedaAide.js
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the `.env.example` file (if available) or create a `.env.local` file:

```bash
cp .env.example .env.local
```

Configure the required environment variables (see [Configuration](#configuration) section).

### 4. Initialize Database

```bash
npm run db:generate
npm run db:migrate
```

This will generate the Prisma client and run database migrations.

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Database
DATABASE_URL="file:./dev.db"

# API Keys
OPENAI_API_KEY="your-api-key-here"
LANGCHAIN_API_KEY="your-api-key-here"

# Application
NEXT_PUBLIC_API_URL="http://localhost:3000"
NODE_ENV="development"
```

### Database Configuration

The project uses Prisma with SQLite by default. To use a different database:

1. Update the `provider` in `prisma/schema.prisma`
2. Update the `DATABASE_URL` in `.env.local`
3. Run migrations: `npm run db:migrate`

## 💻 Development

### Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Available Development Commands

```bash
# Run type checker
npm run type-check

# Format code
npm run format

# Check formatting
npm run format:check

# Launch Prisma Studio (database UI)
npm run db:studio
```

### Development Guidelines

- Follow the [architectural guidelines](docs/guides/GETTING_STARTED.md)
- Use TypeScript for type safety
- Keep components in `src/components/`
- Keep business logic in `src/lib/`
- Use Prisma for all database operations
- Follow ESLint and Prettier rules

## 🧪 Testing

### Run Unit Tests

```bash
# Run tests once
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Run End-to-End Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

### Testing Best Practices

- Write tests for all new features
- Aim for >80% code coverage
- Use descriptive test names
- Group related tests using `describe` blocks
- Test both happy paths and edge cases
- Use mocks for external dependencies (API calls, database queries)

### Test Structure

```
tests/
├── e2e/              # End-to-end tests
├── load/             # Load testing scripts
└── [feature].test.ts # Unit tests
```

## 🏗️ Building

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Check Build Size

```bash
npm run build
# Check the `.next` directory size
```

## 📦 Deployment

### Docker Deployment

Build and run with Docker:

```bash
# Build image
docker build -t vedaaide-js:latest .

# Run container
docker run -p 3000:3000 vedaaide-js:latest
```

### Docker Compose

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down
```

### Azure Deployment

See [DEPLOYMENT-GUIDE.md](docs/DEPLOYMENT-GUIDE.md) for detailed deployment instructions.

## 📁 Project Structure

```
VedaAide.js/
├── src/
│   ├── app/                    # Next.js App Router pages and layouts
│   │   ├── api/               # API routes
│   │   ├── actions/           # Server actions
│   │   ├── _components/       # App-level components
│   │   ├── evaluation/        # Evaluation module
│   │   ├── ingest/            # Document ingestion module
│   │   └── prompts/           # Prompt management
│   ├── components/            # Reusable React components
│   ├── lib/                   # Utility functions and services
│   │   ├── agent/            # AI agent logic
│   │   ├── datasources/      # Data source integrations
│   │   ├── services/         # Business logic services
│   │   ├── stores/           # State management
│   │   └── vector-store/     # Vector embedding storage
│   └── langchain.d.ts        # LangChain type definitions
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
├── tests/
│   ├── e2e/                  # End-to-end tests
│   └── load/                 # Load testing
├── docs/                     # Documentation
├── infra/                    # Infrastructure (Bicep, Docker)
├── scripts/                  # Utility scripts
├── public/                   # Static files
└── configuration files       # tsconfig.json, vitest.config.ts, etc.
```

## 🔧 Key Technologies

- **Frontend**: React 19 with Next.js 15 App Router
- **Styling**: Tailwind CSS with PostCSS
- **Database**: Prisma ORM with SQLite
- **AI/ML**: LangChain with OpenAI integration
- **Testing**: Vitest for unit tests, Playwright for E2E tests
- **Code Quality**: ESLint, Prettier, TypeScript
- **Logging**: Pino for structured logging
- **UI Components**: Radix UI for accessible components

## 📚 Documentation

- [Getting Started Guide](docs/guides/GETTING_STARTED.md)
- [Quick Start](docs/guides/QUICK_START.md)
- [Deployment Guide](docs/DEPLOYMENT-GUIDE.md)
- [FAQ](docs/faq/FAQ.md)

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Commit your changes: `git commit -m "feat: add your feature (#issue_number)"`
3. Push to the branch: `git push origin feature/your-feature-name`
4. Open a Pull Request against `origin/main`

### Code Style

- Follow the existing code style
- Run `npm run lint` before committing
- Run `npm run format` to auto-format code
- Ensure `npm run test` passes
- Ensure `npm run type-check` passes

### Commit Message Format

Use the following format: `type: description (#issue_number)`

Examples:

- `feat: add user authentication (#1)`
- `fix: correct data validation logic (#2)`
- `docs: update README (#3)`

## 🐛 Issues & Bug Reports

Found a bug? Please create an issue with:

- Description of the problem
- Steps to reproduce
- Expected behavior
- Actual behavior
- Your environment (OS, Node version, etc.)

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

- Create an issue on GitHub for bugs and feature requests
- Check existing issues and discussions first
- Review the documentation in the `docs/` folder

## 🔗 Links

- [Project Repository](https://github.com/yourusername/VedaAide.js)
- [Issue Tracker](https://github.com/yourusername/VedaAide.js/issues)
- [Discussions](https://github.com/yourusername/VedaAide.js/discussions)

---

**Last Updated**: April 2026
