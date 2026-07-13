// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: "mdm-react-vite",
            cwd: "/root/mdm-front-end",
            script: "npm",
            args: "run dev:server",
            env: {
                NODE_ENV: "production",
            },
        },
    ],
};