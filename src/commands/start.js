import watch from "./watch.js";
import spawn from "./spawn.js";
import pm2 from "../lib/pm2.js";

import stop from "./stop.js";
import prompt_daemons from "../lib/prompt_daemons.js";

const run_daemons = ({ DAEMONS }) => {
    watch.handler({ DAEMONS });
    spawn.handler({ DAEMONS });

    return pm2({
        commands: [ `logs` ]
    }).done;
};

export default ({
    command: `summon [DAEMONS...]`,
    help: `summon and watch [DAEMONS...]`,
    alias: [ `dev`, `start`, `run` ],
    async handler({ DAEMONS }) {
        const DAEMONs = await prompt_daemons({
            cmd: this,
            DAEMONS
        });

        await stop.handler();
        
        return run_daemons({ DAEMONS: DAEMONs });
    },

    cancel() {
        watch.cancel();
    }
});

