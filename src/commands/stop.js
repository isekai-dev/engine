import exec from "../lib/exec.js";
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

        const { cancel, done } = exec({
            commands: [ `delete`, ...AVATARS ]
        });

        this.canceler = cancel;

        return done;
    }
});

