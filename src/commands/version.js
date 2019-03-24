import { version } from "../../package.json";

export default ({
    command: `version`,
    help: `Version is ${version}`,
    handler: () => {
        console.log(version);
    }
});