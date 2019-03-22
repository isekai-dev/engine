import glob from "glob";
import path from "path";

export default () => 
    glob.sync(`./AVATARS/*.toml`).
        map((class_path) => 
            path.basename(class_path, `.toml`));