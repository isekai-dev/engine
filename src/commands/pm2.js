// pipe out to pm2
import { spawn } from "child_process";

export default ({
    command: `pm2 [commands...]`,
    help: `excute a pm2 command`,
    hidden: true,
    handler: ({ commands }) => 
        spawn(`node`, `${__dirname}/../node_modules/pm2/bin/pm2 ${commands.join(` `)}`.split(` `), {
            env: process.env,
            stdio: `inherit`
        })
});