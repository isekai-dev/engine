export default ({
    LOG: {
        left = `|⚙>`,
        right = `<⚙|`
    },
    SET
}) => {
    const LOG = {
        left,
        right,

        log: (...args) => {
            console.log(`\t`, ...args);
        },

        info: (...args) => {
            console.log(LOG.left, `\t`, ...args, `\t`, LOG.right);
        },

        section: (title, body) => {
            LOG.info(title);
            LOG(body);
            LOG(`\r`);
        }
    };

    SET({
        LOG: Object.assign(LOG.log, LOG)
    });
};