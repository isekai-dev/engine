import get_list from "./get_list.js";

export default (classes) => 
    (fn) => 
        Promise.all(classes.filter((target) => {
            const is_okay = get_list().
                indexOf(target) !== -1;

            if(!is_okay) {
                console.log(`${target} is not an available [CHARACTER]`);
            }
        
            return is_okay;
        }).
            map(fn));
