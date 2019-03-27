import degit from "degit";
import { exec } from "child_process";
import Git from "simple-git/promise";

const git = Git();

export default ({
    command: `create [template] [name]`,
    help: `Create a new isekai project from [template] or @isekai/template`,
    alias: [ `init` ],
    options: {
        "-f, --force": `force overwrite from template`
    },
    handler: ({
        template = `isekai-dev/template`,
        name = `.`,
        options: {
            force = false
        } = false
    }) => degit(template, { force }).
        clone(name).
        then(() => git.init()).
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
            console.log(`COMPLETE: [run] to start your DAEMONs.`);
        })
});