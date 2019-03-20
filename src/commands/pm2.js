// pipe out to pm2
import { spawn } from "child_process";

export default ({
    help: `excute a pm2 command`,
    handler: (cmd) => 
        spawn(`node`, `${__dirname}/../node_modules/pm2/bin/pm2 ${cmd}`.split(` `), {
            env: process.env,
            stdio: `inherit`
        })
});