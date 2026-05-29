import os

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-prod")

ALERT_THRESHOLDS = {
    "cpu": 85,
    "ram": 90,
    "disk": 80,
}

DB_PATH = os.environ.get("DB_PATH", "monitor.db")
ALERT_LOG_PATH = "alerts.log"

STATS_INTERVAL = 2      # seconds between live stat pushes
HISTORY_INTERVAL = 60   # seconds between DB snapshots

# Credentials — override via env vars in production
DASHBOARD_USERNAME = os.environ.get("DASHBOARD_USERNAME", "admin")
DASHBOARD_PASSWORD = os.environ.get("DASHBOARD_PASSWORD", "admin")
