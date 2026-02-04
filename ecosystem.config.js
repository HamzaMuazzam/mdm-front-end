// ecosystem.config.js
module.exports = {
    apps: [
        {
            name: "mdm-react-vite",
            script: "npm",
            args: "run dev",
            env: {
                NODE_ENV: "development",
            },
        },
    ],
};