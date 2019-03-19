import path from "path";
import pm2 from "pm2";

export default (classPath) => {
    const name = path.basename(classPath, `.toml`);

    pm2.start({
        name,
        script: `./BIN/${name}.bundle.js`
    });
};
