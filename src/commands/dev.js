import watch from "./watch.js";
import spawn from "./spawn.js";
import exec from "./pm2.js";

export default ({
    help: `watch and spawn a [CLASS] then follow logs`, 
    handler: (target) => { 
        watch.handler(target);
        spawn.handler(target);
        exec.handler(`logs`);
    }
});

