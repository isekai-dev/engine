import pm2 from "./pm2.js";

export default({
    command: `status`,
    help: `[STATUS] of active [CHARACTERS] files.`,
    alias: [ `ps`, `active` ],
    handler: () => 
        pm2.handler({
            commands: [ `ps` ]
        })
});