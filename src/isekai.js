// Stare into the Abyss
const Isekai = ({
    SET: (obj) => Object.assign(Isekai, obj),

    EQUIP: (obj) => Object.entries(obj).
        forEach(([ key, fn ]) => {
            Isekai[key] = Isekai[key] || {};
                
            fn(Isekai); 
        })
});

export default Isekai;
