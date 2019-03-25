import watch from "./watch.js";
import spawn from "./spawn.js";
import pm2 from "../lib/pm2.js";

import get_list from "../lib/get_list.js";

const run_avatars = ({ AVATARS }) => {
    if(AVATARS[0] === `all`) {
        AVATARS = get_list();
    }

    watch.handler({ AVATARS });
    spawn.handler({ AVATARS });

    return pm2({
        commands: [ `logs` ]
    }).done;
};

export default ({
    command: `run [AVATARS...]`,
    help: `run and watch [AVATAR] files`,
    alias: [ `dev`, `start` ],
    handler({ AVATARS }) {
        if(!AVATARS) {
            this.prompt({
                type: `list`,
                name: `AVATAR`,
                message: `Which [AVATAR] to run?`,
                choices: [ `all`, ...get_list() ]
            }).
                then(({ AVATAR }) => run_avatars({ AVATARS: [ AVATAR ] }));

            return;
        }

        run_avatars({ AVATARS });
    },
    
    cancel() {
        watch.cancel();
    }
});

