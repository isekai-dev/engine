// Stare into the Abyss
const Isekai = ({
    SET: (obj) => Object.entries(obj).
        forEach(([ key, value ]) => {
            Isekai[key] = Isekai[key] || {};
                
            if(typeof value === `function`) {
                Isekai[key] = Object.assign(value, {
                    ...Isekai[key], 
                    ...value
                });
            } else {
                Isekai[key] = Object.assign(Isekai[key], value);
            }
        }),

    EQUIP: (obj) => Object.entries(obj).
        forEach(([ key, fn ]) => {
            Isekai[key] = Isekai[key] || {};
                
            fn(Isekai); 
        })
});

export default Isekai;
