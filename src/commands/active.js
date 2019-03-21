import pm2 from "./pm2.js";

export default({
    command: `active`,
    help: `Show active [CLASS] files.`,
    alias: [ `ps` ],
    handler: () => 
        pm2.handler({
            commands: [ `ps` ]
        })
});