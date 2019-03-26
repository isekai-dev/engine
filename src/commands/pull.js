import Git from "simple-git/promise";
import { exec } from "child_process";

const git = Git();

export default ({
    command: `pull`,
    help: `get current files from source control`,
    handler: () => git.pull(`origin`, `master`).
        then(() => new Promise((resolve, reject) => {
            exec(`npm install`, (err) => {
                if(err) {
                    reject(err);
                }
                resolve();
            });
        })).
        then(() => console.log(`Pulled latest from source control.`))
});
