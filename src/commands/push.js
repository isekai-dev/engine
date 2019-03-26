import vorpal from "vorpal";
import fetch from "node-fetch";
import glob from "glob";
import get_config from "../lib/get_config.js";

// TODO: This should really be exposed by isekai core some how. Like a way to add in tools
export default ({
    command: `push <message>`,
    alias: [ `publish` ],
    handler: async ({ message }) => {
        // await vorpal.exec(`commit ${message}`);

        await Promise.all(glob.sync(`./AVATARS/*.toml`).
            map((avatar) => {
                const { ADMIN } = get_config(avatar);
                if(ADMIN && ADMIN.zalgo) {
                    const { 
                        url = `http://localhost:8080`,
                        zalgo 
                    } = ADMIN;
                    console.log(`PUSHING [${avatar}] - ${url}`);

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