import express from "express";
import greenlock from "greenlock-express";
import http from "http";
import helmet from "helmet";

import sub_skills from "./SKILLS/*.js";

// for express nto to send stack traces
process.env.NODE_ENV = `production`;

export default ({
    EQUIP
}) => EQUIP({
    HTTP: ({
        HTTP: {
            SSL = false,
            port = 8080
        },
        SET,
    }) => {
        const app = express();
        app.use(helmet());

        if(SSL) {
            const {
                agreeTos,
                email,
                approvedDomains,
                configDir = `~/.config/ssl`,
                communityMember = false,
                telemetry = false,
                ssl_port = 443,
                redirect = 80
            } = SSL;
        
            if(!agreeTos || !email || !approvedDomains) {
                const not_filled = Object.entries({ 
                    agreeTos,
                    email,
                    approvedDomains 
                }).
                    filter(([ , value ]) => value).
                    map((key) => key).
                    join(` - `);
        
                throw new Error(`You've enabled SSL but not configured SSL: ${not_filled}`);
            }
            
            greenlock.create({
                telemetry,
                agreeTos,
                email,
                configDir,
                communityMember,
                approvedDomains,
                app,
            }).
                listen(redirect, ssl_port);
        

            console.log(`[HTTPS]`);
            console.log(`BIFROST SECURED`);
                
            /*
             * if(redirect) {
             *     const redirectApp = express();
             */
            
            //     console.log(`Redirecting to HTTP to HTTPS`);
        
            /*
             *     redirectApp.all(`*`, (req, res) => {  
             *         res.redirect(`https://${req.headers.host}${req.url}`);
             *         res.end();
             *     });
             */
        
            /*
             *     http.createServer(redirectApp).
             *         listen(redirect);
             */
        
            // }
        
        } else {
            app.listen(port, () => {
                console.log(`⚠️[HTTP]⚠️`);
                console.log(`BIFROST INSECURE`);
                console.log(`Listening on http://localhost:8080`);
            });
        }
            
        SET({
            HTTP: app
        });
    },    
    ...sub_skills
});
