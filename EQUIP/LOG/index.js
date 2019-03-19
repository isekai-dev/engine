export default ({
    CONSOLE: {
        left = `|⚙>`,
        right = `<⚙|`
    },
    equip
}) => {
    const LOG = {
        log: (...args) => {
            console.log(`\t`, ...args);
        },

        info: (...args) => {
            console.log(left, `\t`, ...args, `\t`, right);
        },

        section: (title, body) => {
            LOG.info(title);
            LOG(body);
            LOG(`\r`);
        }
    };

    equip({
        LOG: Object.assign(LOG.log, LOG)
    });
};