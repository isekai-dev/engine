
const addListeners = (object) => 
    Object.entries(object).
        map(([ evt, handler ]) => {
            window.addEventListener(evt, handler);

            return () => {
                window.removeEventListener(evt, handler);
            };
        });

const keys = {

};

const handlerMap = new Map();

const global_handlers = new Set();

addListeners({
    keydown: ({ which }) => {
        keys[which] = true;
    },
    keyup: ({ which }) => {
        keys[which] = false;
    },
    keypress: ({ which }) => {

        global_handlers.forEach((handler) => 
            handler(which));
        
        const handlers = handlerMap.get(which);

        if(!handlers) {
            return;
        }

        handlers.forEach((handler) => 
            handler(which));
    }
});

export default Object.assign(({
    which,
    handler
}) => {
    if(!which) {
        global_handlers.add(handler);
        
        return () => {
            global_handlers.delete(handler);
        };
    }

    const set = handlerMap.get(which) || new Set();

    set.add(handler);
    handlerMap.set(which, set);

    return () => {
        set.remove(handler);
    };
}, { keys });