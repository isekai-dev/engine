import pm2 from "./pm2.js";

export default ({
    command: `logs [CHARACTERS...]`,
    help: `follow the active [CHARACTER] logs`,
    handler: ({ CHARACTERS = [] }) => 
        new Promise(() => 
            pm2.handler({
                commands: [ `logs`, ...CHARACTERS ]
            }))
});