import watch from "./watch.js";
import spawn from "./spawn.js";
import exec from "./pm2.js";

export default ({
    command: `start [CLASS...]`,
    help: `start and watch [CLASS] files`, 
    handler: (data) => { 
        watch.handler(data);
        spawn.handler(data);
        exec.handler({
            commands: [ `logs` ]
        });
    },
    cancel: () => {
        watch.cancel();
    }
});

