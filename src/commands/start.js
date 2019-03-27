import watch from "./watch.js";
import spawn from "./spawn.js";
import pm2 from "../lib/pm2.js";

import stop from "./stop.js";
import prompt_daemons from "../lib/prompt_daemons.js";

const run_DAEMONs = ({ DAEMONS }) => {
    watch.handler({ DAEMONS });
    spawn.handler({ DAEMONS });

    return pm2({
        commands: [ `logs` ]
    }).done;
};

export default ({
    command: `run [DAEMONS...]`,
    help: `run and watch [DAEMON] files`,
    alias: [ `dev`, `start` ],
    async handler({ DAEMONS }) {
        const DAEMONs = await prompt_daemons({
            cmd: this,
            DAEMONS
        });

        await stop.handler();
        
        return run_DAEMONs({ DAEMONS: DAEMONs });
    },

    cancel() {
        watch.cancel();
    }
});

