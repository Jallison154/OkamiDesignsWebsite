# Debugging 502 Error - Commands to Run on Proxmox Server

Run these commands in order on your Proxmox CT terminal:

## 1. Check if container is running:
```bash
docker ps | grep okami-designs
```

## 2. Check container logs for errors:
```bash
docker logs okami-designs-website
```

## 3. Check if nginx config is valid:
```bash
cd /opt/okami-designs
docker exec okami-designs-website nginx -t
```

## 4. Check if files exist in container:
```bash
docker exec okami-designs-website ls -la /var/www/okami-designs/
```

## 5. Check if admin.html exists:
```bash
docker exec okami-designs-website ls -la /var/www/okami-designs/admin.html
```

## 6. Restart container completely:
```bash
cd /opt/okami-designs
docker-compose down
docker-compose up -d
```

## 7. Check if port 80 is in use:
```bash
netstat -tulpn | grep :80
```

## 8. Test nginx from inside container:
```bash
docker exec okami-designs-website curl -I http://localhost/admin.html
```

