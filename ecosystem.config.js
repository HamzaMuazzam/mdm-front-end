module.exports = {
    apps: [
        {
            name: "mdm-react-vite",
            cwd: "/root/mdm-front-end",
            script: "npm",
            args: "run dev",
            env: {
                NODE_ENV: "development"
            }
        }
    ]
};