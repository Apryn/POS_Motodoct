#!/bin/bash

# Configuration
DB_USER="motodoct_user"
DB_PASS="motodoct123"
DB_NAME="kasir_motodoct"
BACKUP_DIR="/root/db_backups"
BOT_TOKEN="8458013309:AAEWueJiv7HwDNLgpd2OtiGLBskJQOfyrow"
CHAT_ID="5842172466"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Filename with timestamp
DATE=$(date +"%Y-%m-%d_%H%M%S")
FILENAME="$BACKUP_DIR/backup_${DB_NAME}_$DATE.sql.gz"

# Perform backup using mysqldump and compress it
mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" | gzip > "$FILENAME"

# Check if dump succeeded
if [ $? -eq 0 ]; then
  echo "Backup successful: $FILENAME"
  
  # Send to Telegram
  CAPTION="📂 *Backup Database Kasir Motodoct*%0A📅 Tanggal: $(date +'%d-%m-%Y %H:%M') WIB%0AStatus: ✅ Berhasil"
  curl -s -F document=@"$FILENAME" \
    "https://api.telegram.org/bot$BOT_TOKEN/sendDocument?chat_id=$CHAT_ID&caption=$CAPTION&parse_mode=Markdown" > /dev/null
    
  # Delete backups older than 7 days locally to save disk space
  find "$BACKUP_DIR" -type f -name "backup_${DB_NAME}_*.sql.gz" -mtime +7 -delete
else
  echo "Backup failed!"
  # Send error notification to Telegram
  ERROR_TEXT="❌ *Backup Database Kasir Motodoct GAGAL\!*%0A📅 Tanggal: $(date +'%d-%m-%Y %H:%M') WIB"
  curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
    -d "chat_id=$CHAT_ID" \
    -d "text=$ERROR_TEXT" \
    -d "parse_mode=Markdown" > /dev/null
fi
