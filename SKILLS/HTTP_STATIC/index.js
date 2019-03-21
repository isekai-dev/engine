import express from "express";
import path from "path";

export default ({
    HTTP,
    HTTP_STATIC 
}) => {
    Object.entries(HTTP_STATIC).
        forEach(([ items_path, http_path ]) => {
            console.log(`[HTTP_STATIC] ${items_path} :> ${http_path}`);
            HTTP.use(http_path, express.static(`./ITEMS/${items_path}`, {
                dotfiles: `allow`
            }));
        });
};

