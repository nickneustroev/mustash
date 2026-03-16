#!/bin/bash
set -euo pipefail

ENV_FILE="/tmp/backup-cron.env"
LOG_FILE="/var/log/backup.log"

write_cron_env() {
  /usr/local/bin/node -e '
for (const [key, value] of Object.entries(process.env)) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
    continue;
  const escaped = String(value).replace(/'\''/g, `'\''\\'\'''\''`);
  process.stdout.write(`${key}='\''${escaped}'\''\n`);
}
' > "$ENV_FILE"
}

if [ "${BACKUP_ENABLED:-false}" = "true" ]; then
  echo "Backup enabled, starting cron..."
  write_cron_env
  printf 'SHELL=/bin/bash\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\n%s set -a; . %s; set +a; cd /app && /bin/bash /app/scripts/backup-s3.sh >> %s 2>&1\n' "${BACKUP_CRON}" "$ENV_FILE" "$LOG_FILE" | crontab -
  touch "$LOG_FILE"
  tail -F "$LOG_FILE" &
  exec cron -f
else
  echo "Backup not enabled, sleeping..."
  exec tail -f /dev/null
fi
