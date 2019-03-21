import watch from "./watch.js";
import spawn from "./spawn.js";
import exec from "./pm2.js";

import get_list from "../lib/get_list.js";

export default ({
    command: `start [CHARACTERS...]`,
    help: `start and watch [CHARACTERS] files`,
    alias: [ `dev` ],
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

