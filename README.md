# 📚 Multi-File-Reader  
*A unified platform to read and manage multiple file types in one place.*

## 🚀 Overview
Modern users work with a variety of file types — PDF, EPUB, TXT, and more.  
Each format requires a different application to read, manage, or edit, which increases **RAM usage**, **storage consumption**, and complicates the user workflow.  

**Multi-File-Reader** solves this by allowing users to view and manage multiple file types inside a **single unified interface**, powered by distinctive file readers for each file format.  
 [oai_citation:1‡Multi-File-Reader- AP Capstone Project.pdf](sediment://file_000000002fb47207aac126cd3deb93dd)

---

## 🧩 Problem Statement
- Different file types require different apps to open (PDF apps, EPUB apps, text editors).  
- These apps consume resources and make file management inconvenient.  
- There is no centralized solution to read, organize, and manage files of multiple formats.  

**This project creates a unified, efficient, modern file-reading platform.**  
 [oai_citation:2‡Multi-File-Reader- AP Capstone Project.pdf](sediment://file_000000002fb47207aac126cd3deb93dd)

---

## 🏗️ System Architecture

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
 [oai_citation:3‡Multi-File-Reader- AP Capstone Project.pdf](sediment://file_000000002fb47207aac126cd3deb93dd)

---

## ✨ Key Features

### 🔐 Authentication & Authorization
- User registration & login  
- Role-based access control (Admin/User)  
- JWT-secured session handling  
 [oai_citation:4‡Multi-File-Reader- AP Capstone Project.pdf](sediment://file_000000002fb47207aac126cd3deb93dd)

### 📂 File Management (CRUD)
- Upload files  
- Read files within integrated readers  
- Update or modify file metadata  
- Delete files  
 [oai_citation:5‡Multi-File-Reader- AP Capstone Project.pdf](sediment://file_000000002fb47207aac126cd3deb93dd)

### 🧭 User Interface Features
- Homepage, Profile, Files page, Auth pages  
- Integrated **pagination** for long documents  
- **Search** for specific files  
- **Sort** files by type or alphabetical order  
- **Filter** files by type (PDF, EPUB, TXT, etc.)  
 [oai_citation:6‡Multi-File-Reader- AP Capstone Project.pdf](sediment://file_000000002fb47207aac126cd3deb93dd)

### ☁️ Hosting
- Fully deployed frontend and backend on Vercel  

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | Next.js, TypeScript, TailwindCSS |
| **Backend** | Node.js, Express.js |
| **Database** | PostgreSQL |
| **Authentication** | JWT / OAuth |
| **Hosting** | Vercel |
 [oai_citation:7‡Multi-File-Reader- AP Capstone Project.pdf](sediment://file_000000002fb47207aac126cd3deb93dd)

---

## 🧪 API Overview

| Endpoint | Method | Description | Access |
|---------|--------|-------------|--------|
| `/api/auth/signup` | POST | Register new user | Public |
| `/api/auth/login` | POST | Authenticate user | Public |
| `/api/files/user_id` | GET | Get user’s uploaded files | Authenticated |
| `/api/upload/user_id` | POST | Upload file to cloud | Authenticated |
| `/api/files/user_id` | PUT | Update a file | Authenticated |
| `/api/files/user_id` | DELETE | Delete a file | Authenticated |
| `/api/file_type_reader` | GET | Render a file in correct reader | Authenticated |
 [oai_citation:8‡Multi-File-Reader- AP Capstone Project.pdf](sediment://file_000000002fb47207aac126cd3deb93dd)

---

## 📦 Future Enhancements (Optional Section)
You may add these if you plan to expand:
- AI-powered text summarization for files  
- Notes & bookmarking inside readers  
- Drag-and-drop upload  
- Sharing & collaboration features  
- Support for audio/HTML/Markdown formats  

---

## 🧑‍💻 Installation & Setup (Optional)
If you'd like, I can generate full setup instructions.  
For now, here’s a basic template:

```bash
# Clone the repo
git clone https://github.com/yourusername/multi-file-reader.git

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd backend
npm install

# Start development servers
npm run dev
