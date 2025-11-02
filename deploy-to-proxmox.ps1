# Okami Designs - Deploy to Proxmox Script (PowerShell)
# This script copies the updated files to the Proxmox server

$PROXMOX_HOST = "192.168.10.50"
$PROXMOX_USER = "root"
$PROXMOX_PATH = "/opt/okami-designs"

Write-Host "🚀 Deploying Okami Designs to Proxmox server..." -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "index.html")) {
    Write-Host "❌ Error: index.html not found. Please run this script from the website directory." -ForegroundColor Red
    exit 1
}

# Files to exclude
$excludePatterns = @(".git", "node_modules", ".DS_Store", "deploy*.ps1", "deploy*.sh", "install*.sh", "*.md")

Write-Host "📦 Preparing files to copy..." -ForegroundColor Cyan

# Create a list of files to copy (excluding patterns)
$filesToCopy = Get-ChildItem -Path . -Recurse -File | Where-Object {
    $shouldExclude = $false
    foreach ($pattern in $excludePatterns) {
        if ($_.Name -like $pattern -or $_.FullName -like "*$pattern*") {
            $shouldExclude = $true
            break
        }
    }
    return -not $shouldExclude
}

Write-Host "📤 Copying files to Proxmox..." -ForegroundColor Cyan

# Use pscp (PuTTY SCP) if available, otherwise use scp
$usePscp = Get-Command pscp -ErrorAction SilentlyContinue

foreach ($file in $filesToCopy) {
    $relativePath = $file.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/')
    $remotePath = "$PROXMOX_PATH/$relativePath"
    $remoteDir = Split-Path -Path $remotePath -Parent
    
    Write-Host "  Copying: $relativePath" -ForegroundColor Gray
    
    # Create remote directory first
    if ($usePscp) {
        $createDirCmd = "mkdir -p $remoteDir"
        & plink -ssh -batch -pw "" "$PROXMOX_USER@$PROXMOX_HOST" $createDirCmd 2>$null | Out-Null
        
        # Copy file
        $fullPath = $file.FullName.Replace('\', '/')
        & pscp -batch -pw "" $fullPath "$PROXMOX_USER@${PROXMOX_HOST}:$remotePath" 2>$null
    } else {
        # Use scp (requires OpenSSH)
        $createDirCmd = "mkdir -p $remoteDir"
        ssh -o StrictHostKeyChecking=no "$PROXMOX_USER@$PROXMOX_HOST" $createDirCmd 2>$null | Out-Null
        
        # Copy file
        $fullPath = $file.FullName.Replace('\', '/')
        scp -o StrictHostKeyChecking=no $fullPath "$PROXMOX_USER@${PROXMOX_HOST}:$remotePath" 2>$null
    }
}

Write-Host "✅ Files copied successfully!" -ForegroundColor Green

# Restart the Docker container on Proxmox
Write-Host "🔄 Restarting Docker container on Proxmox..." -ForegroundColor Cyan

if ($usePscp) {
    & plink -ssh -batch -pw "" "$PROXMOX_USER@$PROXMOX_HOST" "cd $PROXMOX_PATH && docker-compose down && docker-compose up -d"
} else {
    ssh -o StrictHostKeyChecking=no "$PROXMOX_USER@$PROXMOX_HOST" "cd $PROXMOX_PATH && docker-compose down && docker-compose up -d"
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error restarting Docker container" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Container restarted successfully!" -ForegroundColor Green

# Check container status
Write-Host "📊 Checking container status..." -ForegroundColor Cyan

if ($usePscp) {
    & plink -ssh -batch -pw "" "$PROXMOX_USER@$PROXMOX_HOST" "docker ps | grep okami-designs"
} else {
    ssh -o StrictHostKeyChecking=no "$PROXMOX_USER@$PROXMOX_HOST" "docker ps | grep okami-designs"
}

Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host "🌐 Website should be accessible at: http://$PROXMOX_HOST" -ForegroundColor Cyan

