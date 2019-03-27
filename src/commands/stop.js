import pm2 from "../lib/pm2.js";
import get_list from "../lib/get_list.js";

export default ({
    command: `stop [DAEMONS...]`,
    help: `stop active [DAEMON] files. `, 
    alias: [`unsummon`, `kill`],
    cancel() {
        this.canceler();
    },
    
    handler({ DAEMONS = get_list() } = false) {
        const whom = DAEMONS.map((char) => `[${char}]`).
            join(` - `);

        console.log(`STOPPING ${whom}`);

        const { cancel, done } = pm2({
            commands: [ `delete`, `all` ]
        });

        this.canceler = cancel;

        return done;
    }
});

