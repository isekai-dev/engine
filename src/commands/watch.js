import chokidar from "chokidar";
import rollup from "rollup";
import c from "chalk";

import toml_to_js from "../transforms/toml_to_js.js";

import action from "../lib/action.js";
import filter_list from "../lib/filter_list.js";
import get_list from "../lib/get_list.js";

const watch_prompt = () => 
    console.log(`[BUILT] PRESS [CTRL+C] TO QUIT YOUR WATCH`);

export default ({
    command: `watch [CHARACTERS...]`,
    help: `watch [CHARACTER] files for changes and rebuild.`,
    hidden: true,
    cancel () {
        this.watchers.forEach((watcher) => 
            watcher.close());
        console.log(`YOUR WATCH HAS ENDED`);
    },
    handler({ CHARACTERS = get_list() }, cb) {
        return new Promise((resolve) => {
            this.watchers = [];
            
            filter_list(CHARACTERS)((target) => {
                const file_path = `./CHARACTERS/${target}.toml`;

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
                        BUNDLE_END: () => {
                            watch_prompt();
                        },
                        FATAL: ({ error }) => {
                            console.error(c.red.bold(error));
                        }
                    }, ({ code }) => 
                        code 
                    ));

                this.watchers.push(rollup_watcher);
            });
        });
    }
});
