# Multi-File-Reader  
*A unified platform to read and manage multiple file types in one place.*

## Overview
Modern users work with a variety of file types — PDF, EPUB, TXT, and more.  
Each format requires a different application to read, manage, or edit, which increases **RAM usage**, **storage consumption**, and complicates the user workflow.  

**Multi-File-Reader** solves this by allowing users to view and manage multiple file types inside a **single unified interface**, powered by distinctive file readers for each file format.  

---

## Problem Statement
- Different file types require different apps to open (PDF apps, EPUB apps, text editors).  
- These apps consume resources and make file management inconvenient.  
- There is no centralized solution to read, organize, and manage files of multiple formats.  

**This project creates a unified, efficient, modern file-reading platform.**  

---

## System Architecture

### High-Level Architecture

### Stack Breakdown  
- **Frontend:** Next.js (React-based) with TailwindCSS  
- **Backend:** Node.js + Express  
- **Database:** PostgreSQL (via NeonTech)  
- **Authentication:** JWT-based login & signup  
- **Hosting:**  
  - Frontend → Vercel  
  - Backend → Vercel  
  - Database → Neon.Tech  

---

## Key Features

### Authentication & Authorization
- User registration & login  
- Role-based access control (Admin/User)  
- JWT-secured session handling  

### File Management (CRUD)
- Upload files  
- Read files within integrated readers  
- Update or modify file metadata  
- Delete files  

### User Interface Features
- Homepage, Profile, Files page, Auth pages  
- Integrated **pagination** for long documents  
- **Search** for specific files  
- **Sort** files by type or alphabetical order  
- **Filter** files by type (PDF, EPUB, TXT, etc.)  

### Hosting
- Fully deployed frontend and backend on Vercel  

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | Next.js, TypeScript, TailwindCSS |
| **Backend** | Node.js, Express.js |
| **Database** | PostgreSQL |
| **Authentication** | JWT / OAuth |
| **Hosting** | Vercel |

---

## API Overview

| Endpoint | Method | Description | Access |
|---------|--------|-------------|--------|
| `/api/auth/signup` | POST | Register new user | Public |
| `/api/auth/login` | POST | Authenticate user | Public |
| `/api/files/user_id` | GET | Get user’s uploaded files | Authenticated |
| `/api/upload/user_id` | POST | Upload file to cloud | Authenticated |
| `/api/files/user_id` | PUT | Update a file | Authenticated |
| `/api/files/user_id` | DELETE | Delete a file | Authenticated |
| `/api/file_type_reader` | GET | Render a file in correct reader | Authenticated |

---

## Future Enhancements (Optional Section)
You may add these if you plan to expand:
- AI-powered text summarization for files  
- Notes & bookmarking inside readers  
- Drag-and-drop upload  
- Sharing & collaboration features  
- Support for audio/HTML/Markdown formats  

---

## Installation & Setup

Install dependencies from the repository root with `npm install`, configure the web and backend environment variables, and run `npm run dev` for the web app.

Run `npm run electron` to start the backend, frontend, and desktop app together. The launcher reuses healthy servers already running on the configured ports and starts missing servers. It reports an unhealthy server or an existing project server on a different port instead of starting a duplicate. Quitting Electron stops only servers started by that launcher. Use `npm run start:electron` to open only the desktop window. Electron waits for the frontend during startup and displays a Retry button if it cannot connect.

The desktop entry points remain `apps/electron/main.js` and `apps/electron/preload.js`. By default they connect to the frontend on port 3000 and the backend on port 2007. To use different ports or hosted servers:

```bash
ELECTRON_FRONTEND_URL=https://your-frontend.example \
ELECTRON_BACKEND_URL=https://your-backend.example \
npm run start:electron
```

Set `NEXT_PUBLIC_BACKEND_URL` for browser builds. Electron also uses it as a fallback when `ELECTRON_BACKEND_URL` is unset. These variables must be exported to the desktop process; Next.js's `.env.local` does not configure Electron automatically. The desktop window loads the configured web app, so that server must remain available.

## Build the desktop application

Run `npm run build` from the repository root. The `scripts` and `build` sections in `package.json` build the Next.js reader and run Electron Builder. Installers and an application archive for the build machine's platform and architecture go into `release/`. On macOS this includes a `.dmg`, `.zip`, and unpacked `.app`. Use `npm run package:electron` to produce only the unpacked application, or `npm run build:web` for the web application alone. `npm start` opens Electron with the configured development servers already running.

The packaged application includes the production Next.js reader and starts it on `127.0.0.1:17767`. You do not need to start development servers to read local documents. The stable address preserves local library entries and bookmarks between launches.

Cloud features use `https://multi-file-reader-server.vercel.app` by default. To package the app for another backend, set its public address during the build:

```bash
ELECTRON_BACKEND_URL=https://your-backend.example npm run build
```

The backend service and its database/storage credentials are not bundled. The macOS build is unsigned for local use; public distribution requires signing and notarization.
