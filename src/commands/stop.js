import pm2 from "../lib/pm2.js";
import get_list from "../lib/get_list.js";

export default ({
    command: `stop [AVATARS...]`,
    help: `stop active [AVATAR] files. `, 
    
    cancel() {
        this.canceler();
    },
    
    handler({ AVATARS = get_list() }) {
        const whom = AVATARS.map((char) => `[${char}]`).
            join(` - `);

        console.log(`STOPPING ${whom}`);

        const { cancel, done } = pm2({
            commands: [ `delete`, ...AVATARS ]
        });

        this.canceler = cancel;

        return done;
    }
});

