import watch from "./watch.js";
import spawn from "./spawn.js";

export default ({
    commands: `dev`,
    help: `run and watch everything`,
    handlers: async () => {
        await watch.handler({ DAEMONS: `all` });
        await spawn.handler({ DAEMONS: `all` });
    }
});
