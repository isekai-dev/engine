import pm2 from "./pm2.js";

export default({
    command: `status`,
    help: `[STATUS] of active [CHARACTER] files.`,
    alias: [ `ps`, `active`, `stats` ],
    handler: () => 
        pm2.handler({
            commands: [ `ps` ]
        })
});