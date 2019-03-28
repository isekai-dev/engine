import glob from "glob";
import path from "path";
import get_config from "./get_config.js";

export default (exclude = false) => {
    if(!exclude) {
        return glob.sync(`./DAEMONS/*.toml`).
            map((class_path) => path.basename(class_path, `.toml`));
    }


    return glob.sync(`./DAEMONS/*.toml`).
        filter((daemon) => get_config(daemon).NODE).
        map((class_path) => path.basename(class_path, `.toml`));
};