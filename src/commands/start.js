import watch from "./watch.js";
import spawn from "./spawn.js";
import exec from "./pm2.js";

import get_list from "../lib/get_list.js";

export default ({
    command: `run [...CHARACTERs]`,
    help: `run and watch [CHARACTER] files`,
    alias: [ `dev`, `start` ],
    handler(data) { 
        this.data = data.CHARACTERS 
            ? data
            : { CHARACTERS: get_list() };

        watch.handler(this.data);
        spawn.handler(this.data);

        exec.handler({
            commands: [ `logs` ]
        });
    },
    cancel() {
        watch.cancel();
    }
});

