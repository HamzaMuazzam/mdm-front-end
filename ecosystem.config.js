module.exports = {
    apps: [
        {
            name: "mdm-react-vite",
            script: "npm",
            args: "run dev",
            cwd: __dirname,
            interpreter: "none",
            autorestart: true,
            watch: false,
            env: {
                NODE_ENV: "development"
            }
        }
    ]
};
