import glob from "glob";
import path from "path";

export default () => 
    glob.sync(`./CLASS/*.toml`).
        map((class_path) => 
            path.basename(class_path, `.toml`));