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
- Open local files in the desktop app without uploading
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
| `/files` | GET | List the user’s file metadata | Authenticated |
| `/api/files/user_id` | PUT | Update a file | Authenticated |
| `/api/files/user_id` | DELETE | Delete a file | Authenticated |
| `/api/file_type_reader` | GET | Render a file in correct reader | Authenticated |

---

## Planned features

**Google Drive import — coming soon.** The UI shows a disabled preview of this feature; it does not authorize or read Drive files yet. The branch workflow and step-by-step local-first/Google Drive refactor plan are kept locally in `DEVELOPMENT_PLAN.md`, which is excluded from Git.

The following are deferred beyond the first refactor release:
- **Web local-file reading:** Open selected files in the browser without uploading them to a server.

### Other unscheduled ideas
- AI-powered text summarization for files  
- Notes & bookmarking inside readers  
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

For local Electron development, copy `apps/electron/.env.local.example` to
`apps/electron/.env.local`. For a packaged build, copy
`apps/electron/.env.production.example` to `apps/electron/.env.production`.
The production Electron file only contains the public backend URL; database,
JWT, and storage credentials must remain in the server deployment.

## Build the desktop application

Run `npm run build` from the repository root. The `scripts` and `build` sections in `package.json` build the Next.js reader and run Electron Builder. Installers and an application archive for the build machine's platform and architecture go into `release/`. On macOS this includes a `.dmg`, `.zip`, and unpacked `.app`. Use `npm run package:electron` to produce only the unpacked application, or `npm run build:web` for the web application alone. `npm start` opens Electron with the configured development servers already running.

The packaged application includes the production Next.js reader and starts it on `127.0.0.1:17767`. You do not need to start development servers to read local documents. The stable address preserves local library entries and bookmarks between launches.

### File sources and cloud upload retirement

Hosted cloud uploads have been retired to remove the extra upload step and avoid duplicate copies of documents. MultiReader is a reader, not a file-hosting service. Use the desktop app's **Open local files** or **Open folder** actions to read PDF, EPUB, and TXT documents without uploading or signing in.

Google Drive import is planned so users can read documents where they already keep them, without copying them to application-owned storage. It is not implemented yet.

The hosted upload endpoint, browser upload form, and native upload actions have been removed. `/fileupload` remains the **Add files** page to preserve existing navigation. Legacy GCS read/delete support remains; removing the upload feature does not delete storage objects or saved bookmarks.

`NEXT_PUBLIC_CLOUD_STORAGE_ENABLED` only controls legacy hosted-document reads. It cannot re-enable uploads or activate the upcoming Drive import.

The **Desktop app setup** link points to the build instructions above. Set `NEXT_PUBLIC_DESKTOP_APP_URL` to your published desktop download or setup page before building to use a different destination.

Cloud features use `https://multi-file-reader-server.vercel.app` by default. To package the app for another backend, set its public address during the build:

```bash
ELECTRON_BACKEND_URL=https://your-backend.example npm run build
```

The backend service and its database/storage credentials are not bundled. The macOS build is unsigned for local use; public distribution requires signing and notarization.
