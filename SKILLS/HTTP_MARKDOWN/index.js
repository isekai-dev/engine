import fs from "fs";
import commonmark from "commonmark";
import chokidar from "chokidar";

import { version } from "../../package.json";

const last_restart = new Date();
const power_words = (target) => 
    target.
        replace(/(\[.[^\]\[]*\])/ug, `<span class='power_word'>$1</span>`).
        replace(`\${version}`, version).
        replace(`\${server_restart}`, `${last_restart.toLocaleString()} PDT`);

const make_data = ([ markdown, template ]) => {
    const reader = new commonmark.Parser();
    const writer = new commonmark.HtmlRenderer();
    
    const md_data = fs.readFileSync(markdown, `utf-8`);
    const html = writer.render(reader.parse(md_data));
    
    const tp_data = fs.readFileSync(template, `utf-8`);
    
    return power_words(tp_data.replace(`<markdown/>`, html));
};

export default ({
    HTTP,
    HTTP_MARKDOWN
}) => {
    Object.entries(HTTP_MARKDOWN).
        forEach(([ 
            path, {
                markdown,
                template
            } 
        ]) => {
            console.log(`[HTTP_MARKDOWN] ${markdown} :> ${path}`);
            const paths = [ `./ITEMS/${markdown}`, `./ITEMS/${template}` ];

            let data = make_data(paths);

            chokidar.watch(paths, {
                usePolling: true
            }).
                on(`change`, () => {
                    data = make_data(paths);
                    console.log(`[HTTP_MARKDOWN] UPDATED ${markdown} :> ${path}`);
                });

            HTTP.get(path, (req, res) => {
                res.send(data);
            });
        });
};