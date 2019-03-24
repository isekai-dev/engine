// pipe out to pm2
import { spawn } from "child_process";

export default ({ commands }) => {
    let node = spawn(`node`, `${__dirname}/../node_modules/pm2/bin/pm2 ${commands.join(` `)}`.split(` `), {
        env: process.env,
        stdio: `inherit`
    });

    return {
        done: new Promise((resolve) => {
            node.on(`close`, () => {
                resolve();
                node = false;
            });
        }),

        cancel: () => {
            if(!node) {
                return;
            }
    
            node.kill();
        }   
    };
};
