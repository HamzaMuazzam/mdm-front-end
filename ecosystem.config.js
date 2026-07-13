// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: "mdm-react-vite",
            script: "npm",
            args: "run dev:server",
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};