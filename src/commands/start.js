import watch from "./watch.js";
import spawn from "./spawn.js";
import exec from "./pm2.js";
import stop from "./stop.js";
import get_list from "../lib/get_list.js";

export default ({
    command: `start [CLASS...]`,
    help: `start and watch [CLASS] files`, 
    handler(data) { 
        this.data = data.CLASS 
            ? data
            : { CLASS: get_list() };

        watch.handler(this.data);
        spawn.handler(this.data);

        exec.handler({
            commands: [ `logs` ]
        });
    },
    cancel() {
        watch.cancel();
        console.log(`STOPPING ${this.data.CLASS.map((i) => 
            `[${i}]`).
            join(` - `)}`);
        
        return stop.handler(this.data);
    }
});

