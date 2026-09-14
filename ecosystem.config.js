module.exports = {
  apps: [
    {
      name: "clip-api",
      script: "python",
      args: "-m uvicorn api.main:app --host 0.0.0.0 --port 3006",
      env: {
        PYTHONUNBUFFERED: "1"
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "2G"
    },
    {
      name: "yt-clipper-bot",
      script: "bot/main.py",
      interpreter: "python",
      env: {
        PYTHONUNBUFFERED: "1"
      },
      autorestart: true,
      max_memory_restart: "6G",
      watch: false,
      max_restarts: 10,
      restart_delay: 5000
    }
  ]
};
