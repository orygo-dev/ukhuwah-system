module.exports = {
  apps: [
    {
      name: "ukhuwah-system",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3112",
      },
      max_memory_restart: "1024M",
    },
  ],
};
