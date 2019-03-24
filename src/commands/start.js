import watch from "./watch.js";
import spawn from "./spawn.js";
import exec from "../lib/exec.js";

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

        return exec({
            commands: [ `logs` ]
        }).done;
    },
    cancel() {
        watch.cancel();
    }
});

