import degit from "degit";
import { exec } from "child_process";

export default ({
    command: `create [template] [name]`,
    help: `Create a new isekai project from [template] or @isekai/template`,
    alias: [ `init` ],

    handler: ({
        template = `isekai-dev/template`,
        name = `.`,
        force = false
    }) => degit(template, { force }).
        clone(name).
        then(() => new Promise((resolve, reject) => {
            console.log(`${template} copied to ${name}`);
            console.log(`INSTALLING: THIS MAY TAKE AWHILE`);
            exec(`npm install`, (err) => {
                if(err) {
                    reject(err);
                }
                resolve();
            });
        })).
        then(() => {
            console.log(`COMPLETE: 'isekai start' to run your avatars.`);
        })
});