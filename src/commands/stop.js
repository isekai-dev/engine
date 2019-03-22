import pm2 from "./pm2.js";
import get_list from "../lib/get_list.js";

export default ({
    command: `stop [AVATARS...]`,
    help: `stop active [AVATAR] files. `, 

    handler: ({ AVATARS = get_list() }) => {
        const whom = AVATARS.map((char) => 
            `[${char}]`).
            join(` - `);

        console.log(`STOPPING ${whom}`);

        pm2.handler({
            commands: [ `delete`, ...AVATARS ]
        });
    }
});

