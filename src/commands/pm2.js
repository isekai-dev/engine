// pipe out to pm2
import { spawn } from "child_process";

// TODO: MOve out of commands
export default ({
    command: `pm2 [commands...]`,

    help: `execute a pm2 command`,
    hidden: true,

    cancel() {
        if(!this.node) {
            return;
        }

        this.node.kill();
    },

    handler({ commands }, cb) {
        if(!commands) {
            console.log(`You must provide commands for pm2\r\n`);
            
            return cb();
        }
        
        return new Promise((resolve) => {
            this.node = spawn(`node`, `${__dirname}/../node_modules/pm2/bin/pm2 ${commands.join(` `)}`.split(` `), {
                env: process.env,
                stdio: `inherit`
            });

            this.node.on(`close`, () => {
                resolve();
            });
        });
    }
});