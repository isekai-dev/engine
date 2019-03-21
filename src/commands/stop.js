import pm2 from "./pm2.js";

export default ({
    command: `stop [CLASS...]`,
    help: `stop active CLASS] files. `, 

    handler: ({ CLASS = [ `all` ] }) => 
        pm2.handler({
            commands: [ `delete`, ...CLASS ]
        })
});

