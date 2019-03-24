import watch from "./watch.js";
import spawn from "./spawn.js";
import pm2 from "../lib/pm2.js";

import get_list from "../lib/get_list.js";

export default ({
    command: `run [...AVATARs]`,
    help: `run and watch [AVATAR] files`,
    alias: [ `dev`, `start` ],
    handler(data) { 
        this.data = data.AVATARS 
            ? data
            : { AVATARS: get_list() };

        watch.handler(this.data);
        spawn.handler(this.data);

        return pm2({
            commands: [ `logs` ]
        }).done;
    },
    cancel() {
        watch.cancel();
    }
});

