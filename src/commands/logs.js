import pm2 from "./pm2.js";

export default ({
    command: `logs [CLASS...]`,
    help: `follow the logs`,
    handler: ({ CLASS = [] }) => 
        new Promise(() => 
            pm2.handler({
                commands: [ `logs`, ...CLASS ]
            }))
});