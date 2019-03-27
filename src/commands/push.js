import fetch from "node-fetch";
import glob from "glob";
import get_config from "../lib/get_config.js";
import path from "path";

// TODO: This should really be exposed by isekai core some how. Like a way to add in tools
export default ({
    command: `push`,
    alias: [ `publish` ],
    async handler() {
        await Promise.all(glob.sync(`./DAEMONS/*.toml`).
            map((DAEMON) => {
                const { ADMIN } = get_config(DAEMON);
                if(ADMIN && ADMIN.zalgo) {
                    const { 
                        url = `http://localhost:8080`,
                        zalgo 
                    } = ADMIN;
                    console.log(`PUSHING [${path.basename(DAEMON, `.toml`)}] - ${url}`);

                    return fetch(`${url}/zalgo`, {
                        method: `POST`,
                        cache: `no-cache`,
                        headers: {
                            "Content-Type": `application/json`
                        },
                        body: JSON.stringify({
                            zalgo
                        })
                    });
                }

                return Promise.resolve();
            }));

    }
});