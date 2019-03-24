import c from "chalk";

const { log } = console;

console.log = (...args) => log(
    ...args.map(
        (item) => typeof item === `string`
            ? c.green(
                item.replace(/(\[.[^\]\[]*\])/ug, c.bold.white(`$1`))
            )
            : item
    )
);
