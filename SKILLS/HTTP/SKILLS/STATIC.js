import express from "express";

export default ({
    HTTP 
}) => {
    const {
        STATIC = {}
    } = HTTP;

    Object.entries(STATIC).
        forEach(([ items_path, http_path ]) => {
            console.log(`[HTTP.STATIC] ${items_path} :> ${http_path}`);
            HTTP.use(http_path, express.static(`./DATA/${items_path}`, {
                dotfiles: `allow`
            }));
        });
};

