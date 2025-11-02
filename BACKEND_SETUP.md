# Backend API Setup Guide

## Overview
The website now has a Node.js/Express backend API for file uploads and management. Files are stored on the server in the `files/` directory.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Backend
The backend will automatically start when you run:
```bash
docker-compose up -d
```

Or manually:
```bash
npm start
```

### 3. API Endpoints

- `GET /api/health` - Check if API is running
- `GET /api/files` - Get all uploaded files
- `GET /api/manifest` - Get manifest.json
- `POST /api/upload` - Upload file (with optional logo)
- `DELETE /api/files/:id` - Delete a file
- `PUT /api/files/:id` - Update file metadata

### 4. File Storage

Files are stored in the `files/` directory:
- Uploaded files: `files/filename_timestamp_randomid.ext`
- Logo files: `files/filename_timestamp_randomid_logo.ext`
- Manifest: `files/manifest.json`

### 5. Docker Deployment

The docker-compose.yml now includes:
- `okami-designs-api` - Node.js backend (port 3000)
- `okami-designs-web` - Nginx frontend (ports 80/443)

Nginx proxies `/api/*` requests to the backend.

## Troubleshooting

### Backend not starting
```bash
docker logs okami-designs-api
```

### Check API health
Visit: `http://your-server/api/health`

### Manual restart
```bash
docker-compose restart okami-designs-api
```

