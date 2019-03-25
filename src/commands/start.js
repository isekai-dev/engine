import watch from "./watch.js";
import spawn from "./spawn.js";
import pm2 from "../lib/pm2.js";

import prompt_avatars from "../lib/prompt_avatars.js";

const run_avatars = ({ AVATARS }) => {
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
    async handler({ AVATARS }) {
        const avatars = await prompt_avatars({
            cmd: this,
            AVATARS
        });

        return run_avatars({ AVATARS: avatars });
    },

    cancel() {
        watch.cancel();
    }
});

