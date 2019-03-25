import chokidar from "chokidar";
import rollup from "rollup";
import c from "chalk";

import toml_to_js from "../transforms/toml_to_js.js";

import action from "../lib/action.js";
import prompt_avatars from "../lib/prompt_avatars.js";

export default ({
    command: `load [AVATARS...]`,
    help: `load [AVATAR] saves`,
    alias: [ `regenerate`, `recreate`, `watch` ],
    hidden: true,
    cancel () {
        this.watchers.forEach((watcher) => watcher.close());
        console.log(`YOUR WATCH HAS ENDED`);
    },
    async handler({ AVATARS }) {
        this.watchers = [];
            
        const avatars = await prompt_avatars({
            cmd: this,
            AVATARS
        });
        
        avatars.forEach((target) => {
            const file_path = `./AVATARS/${target}.toml`;

            const data = toml_to_js(file_path);

            const { build_info } = data;
        
            // rebuild on file chagne
            const watcher = chokidar.watch(file_path);
                
            watcher.on(`change`, () => {
                toml_to_js(file_path);
            });
                
            this.watchers.push(watcher);

            const rollup_watcher = rollup.watch({
                ...build_info,
                watch: {
                    clearScreen: true
                }   
            }).
                on(`event`, action({
                    ERROR: (e) => {
                        console.log(e);
                    },
                    FATAL: ({ error }) => {
                        console.error(c.red.bold(error));
                    }
                }, ({ code }) => code 
                ));

            this.watchers.push(rollup_watcher);
        });
    }
});
