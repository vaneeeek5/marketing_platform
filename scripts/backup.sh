#!/bin/bash

# Configuration
BACKUP_DIR="./backups"
DB_CONTAINER="marketing-platform-db"
DB_NAME="marketing_platform"
DB_USER="nextjs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"
YANDEX_DISK_PATH="yandex:backups/marketing_platform"

echo "🚀 Starting database backup..."

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Dump and compress database
echo "📦 Dumping database..."
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup created: $BACKUP_FILE"
else
    echo "❌ Error: Database dump failed"
    exit 1
fi

# Upload to Yandex Disk using rclone
if command -v rclone &> /dev/null; then
    echo "☁️ Uploading to Yandex Disk..."
    rclone copy "$BACKUP_FILE" "$YANDEX_DISK_PATH"
    
    if [ $? -eq 0 ]; then
        echo "✅ Upload successful!"
        # Optional: delete local backup older than 7 days
        find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +7 -delete
    else
        echo "❌ Error: Upload to Yandex Disk failed"
    fi
else
    echo "⚠️ Warning: rclone not found. Skipping upload."
    echo "Please install rclone: 'sudo apt install rclone' and configure 'yandex' remote."
fi

echo "🏁 Backup process finished."
