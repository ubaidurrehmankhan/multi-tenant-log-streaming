# Orders API - Frontend

React 19 + Vite + TypeScript + Tailwind CSS frontend for the Orders API.

## Tech Stack

- **React 19** - UI library
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework (lime-500 accent)
- **React Query** - Data fetching and caching
- **React Hook Form** - Form management
- **Zod** - Schema validation
- **Axios** - HTTP client

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Install dependencies
npm install

# Start development server (port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Create `.env.local`:

```
VITE_API_URL=http://localhost:3000
```

## Docker

### Production Build

```bash
# Build image
docker build -t orders-frontend .

# Run container
docker run -p 80:80 orders-frontend
```

### Development with Docker Compose

```bash
# Start all services
docker-compose up

# Start with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## Project Structure

```
src/
├── main.tsx          # App entry point with React Query provider
├── App.tsx           # Root component
├── index.css         # Tailwind imports and global styles
├── api/              # API client and hooks (to be added)
├── components/       # Reusable UI components (to be added)
├── hooks/            # Custom hooks (to be added)
└── schemas/          # Zod validation schemas (to be added)
```

## Features

- ✅ React 19 with TypeScript
- ✅ Vite for fast HMR
- ✅ Tailwind CSS configured with lime-500 accent
- ✅ React Query for server state
- ✅ Multi-stage Docker build with nginx
- ✅ Health check endpoint at `/health`

## Acceptance Criteria

- [x] `npm run dev` starts on port 5173
- [x] Tailwind styles work
- [x] React Query provider configured
- [x] Dockerfile builds successfully
