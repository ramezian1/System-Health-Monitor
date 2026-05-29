import os
import secrets

# Use the provided secret in production; otherwise generate a strong random key
# at startup so sessions are never signed with a predictable hardcoded value.
# (A generated key means sessions reset on restart, which is the safe default.)
SECRET_KEY = os.environ.get("SECRET_KEY") or secrets.token_hex(32)

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

# True when the login is still on the built-in defaults (used to warn at startup)
USING_DEFAULT_CREDENTIALS = (
    "DASHBOARD_USERNAME" not in os.environ
    and "DASHBOARD_PASSWORD" not in os.environ
)
