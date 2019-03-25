import get_list from "./get_list.js";

export default (classes) => classes.filter((target) => {
    const is_okay = get_list().
        indexOf(target) !== -1;

    if(!is_okay) {
        console.log(`${target} is not an available [AVATAR]`);
    }
        
    return is_okay;
});
