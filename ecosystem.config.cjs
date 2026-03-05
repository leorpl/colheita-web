module.exports = {
  apps: [
    {
      name: "colheita",
      cwd: "/var/www/app",
      script: "src/server.js",
      env_file: "/var/www/app/.env",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
}
