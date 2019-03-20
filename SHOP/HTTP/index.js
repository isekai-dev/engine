
import express from "express";
import fs from "fs";

import https from "https";
import http from "http";
import LOG_equip from "../LOG/index.js";

export default ({
    LOG,
    HTTP: {
        ssl = false
    },
    SET, 
    EQUIP
}) => {
    const app = express();

    if(!LOG) {
        console.log(`EQUIPING LOG`);
        EQUIP({
            LOG: LOG_equip
        });
    }

    if(ssl) {
        https.createServer({
            key: fs.readFileSync(`${ssl}/privkey.pem`),
            cert: fs.readFileSync(`${ssl}/cert.pem`),
            ca: fs.readFileSync(`${ssl}/fullchain.pem`)
        }, app).
            listen(443, () => {
                LOG.info(`[HTTPS]`);
                LOG(`BIFROST SECURED`);
            });

        const redirectApp = express();
    
        LOG(`Redirecting to HTTP to HTTPS`);

        redirectApp.all(`*`, (req, res) => {  
            res.redirect(`https://${req.headers.host}${req.url}`);
            res.end();
        });

        http.createServer(redirectApp).
            listen(80);

    } else {
        app.listen(8080, () => {
            LOG.info(`⚠️[HTTP]⚠️`);
            LOG(`BIFROST INSECURE`);
            LOG(`Listening on port 8080`);
        });
    }
    
    SET({
        HTTP: {
            app
        }
    });
};