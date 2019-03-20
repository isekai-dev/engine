import watcher from "chokidar";
import rollup from "rollup";
import c from "chalk";

import toml_to_js from "../transforms/toml_to_js.js";

import action from "../lib/action.js";
import filter_list from "../lib/filter_list.js";
import get_list from "../lib/get_list.js";

export default ({
    command: `watch [classes...]`,
    help: `watch [CLASS] files for changes and rebuild.`,
    handler: ({ classes = get_list() }) =>
        filter_list(classes)((target) => {
            const data = toml_to_js(`./CLASS/${target}.toml`);
            
            const { build_info } = data;
        
            // rebuild on file chagne
            watcher.watch(target).
                on(`change`, () => {
                    toml_to_js(target);
                });

            rollup.watch({
                ...build_info,
                watch: {
                    clearScreen: true
                }   
            }).
                on(`event`, action({
                    BUNDLE_END: () => {
                        console.log(`[BUILD DONE]`);
                    },
                    FATAL: ({ error }) => {
                        console.error(c.red.bold(error));
                    }
                }, ({ code }) => 
                    code 
                ));

            return data;
        })
});
