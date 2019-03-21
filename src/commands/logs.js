import pm2 from "./pm2.js";

export default ({
    command: `logs [targets...]`,
    help: `follow the logs`,
    handler: () => 
        new Promise(() => 
            pm2.handler({
                commands: [ `logs` ]
            }))
});