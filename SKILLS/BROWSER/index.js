import keys from "./keys.js";

export default ({
    set
}) => {
    set({
        BROWSER: {
            keys, 
        }
    });
};