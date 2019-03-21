import pm2 from "./pm2.js";

export default ({
    command: `stop [CHARACTERS...]`,
    help: `stop active CHARACTERS] files. `, 

    handler: ({ CHARACTERS = [ `all` ] }) => 
        pm2.handler({
            commands: [ `delete`, ...CHARACTERS ]
        })
});

