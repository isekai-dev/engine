import pm2 from "../lib/pm2.js";

export default({
    command: `status [AVATAR]`,
    help: `status of active [AVATAR]s.`,
    alias: [ `ps`, `active`, `stats` ],
    handler: () => pm2({
        commands: [ `ps` ]
    }).done
});