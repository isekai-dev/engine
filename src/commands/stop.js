import pm2 from "./pm2.js";
import get_list from "../lib/get_list.js";

export default ({
    command: `stop [CHARACTERS...]`,
    help: `stop active [CHARACTER] files. `, 

    handler: ({ CHARACTERS = get_list() }) => {
        const whom = CHARACTERS.map((char) => 
            `[${char}]`).
            join(` - `);

        console.log(`STOPPING ${whom}`);

        pm2.handler({
            commands: [ `delete`, ...CHARACTERS ]
        });
    }
});

