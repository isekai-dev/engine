import niceware from "niceware";

export default ({
    HTTP: {
        API,
    },
    SET
}) => {
    const ZALGOS = new Map(Object.entries({
        echo: () => ({
            message: `echo` 
        })
    }));

    const set_zalgo = ({
        zalgo,
        strength = 12,
        handler
    }) => {
        zalgo = zalgo || niceware.generatePassphrase(strength).
            join(` `);

        ZALGOS.set(zalgo, handler);
        
        return zalgo;
    };

    const fire = ({
        zalgo,
        data = {}
    }) => {
        console.log(ZALGOS.keys(), zalgo, ZALGOS.has(zalgo));

        if(!ZALGOS.has(zalgo)) {
            return;
        }

        return ZALGOS.get(zalgo)(data);
    };

    const remove = (zalgo) => {
        ZALGOS.delete(zalgo);
    };

    SET({
        ZALGO: Object.assign(set_zalgo, {
            remove,
            fire,
        })
    });

    API.post(`/zalgo`, ({ body }, res) => {
        res.setHeader(`Content-Type`, `application/json`);

        res.end(JSON.stringify(fire(body) || {}));
    });
};