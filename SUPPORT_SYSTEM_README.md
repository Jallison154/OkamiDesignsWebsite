# Support & Admin System

## Overview

Added a password-protected admin panel for uploading documentation files and a public support page for customers to download them.

## Pages Created

### 1. Support Page (`support.html`)
- Public page for customers to view and download documentation
- Displays all uploaded files in a grid
- No authentication required
- Styled to match the Okami Designs brand

### 2. Admin Panel (`admin.html`)
- Password-protected upload area
- Upload files via drag-and-drop or file picker
- View all uploaded files
- Delete files with confirmation

## How to Use

### For Admins (Uploading Files)

1. Navigate to `admin.html` in your browser
2. Enter password: `okami2024` (change this in admin.js)
3. Drag files to the upload box or click "Choose Files"
4. Files are stored in browser localStorage (client-side only)
5. Files appear on the support page automatically

### For Customers

1. Navigate to `support.html`
2. View available documentation
3. Click "Download" to get any file

## Important Notes

**Current Implementation:**
- Files are stored in browser `localStorage` (not persistent across browsers/devices)
- All file uploads are client-side only
- No server or database backend
- **Blob URLs from localStorage may not work across browser sessions** - this is a limitation of storing files entirely in the browser

**For Production Use:**
You'll need to:
1. Set up a backend server (e.g., Node.js, PHP, Python)
2. Store files in a cloud service (AWS S3, Google Cloud Storage) or local directory
3. Use a proper database for file metadata
4. Implement real authentication (not just a password check)
5. Add file size limits and security checks

## Change the Admin Password

Edit `admin.js` line 7:
```javascript
const ADMIN_PASSWORD = 'your-secure-password-here';
```

## File Storage

Currently uses localStorage, which has these limits:
- ~5-10MB total storage per domain
- Only works in same browser/session
- Cleared when browser cache is cleared

## Testing

1. Open `admin.html` in your browser
2. Login with password `okami2024`
3. Upload a test PDF or document
4. Open `support.html` in another tab
5. Verify the file appears and downloads work

## Next Steps (Production)

For a real implementation on your Proxmox server:

1. **Backend Options:**
   - Node.js/Express with multer for file uploads
   - PHP with file upload handling
   - Python Flask with file handling

2. **Storage Options:**
   - Local filesystem: `/var/www/okami-designs/uploads/`
   - PostgreSQL database for metadata
   - Cloud storage (AWS S3, DigitalOcean Spaces)

3. **Authentication:**
   - JWT tokens
   - Session management
   - Rate limiting for uploads

4. **Security:**
   - File type validation
   - File size limits
   - Virus scanning
   - Access logging

## Current Features Working

✅ Password-protected admin login
✅ Drag-and-drop file upload
✅ File display grid
✅ Download functionality
✅ Delete files
✅ Responsive design
✅ Brand-consistent styling
✅ Support page link in navigation

## Files Created

- `support.html` - Public documentation page
- `admin.html` - Admin upload panel
- `admin.js` - Admin authentication & upload logic
- `support.js` - Display uploaded files
- Updated `styles.css` - Added support & admin styles
- Updated navigation in all pages

The system is ready to use for local testing! 🎉

