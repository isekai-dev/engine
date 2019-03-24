import degit from "degit";

export default ({
    command: `create [template] [name]`,
    help: `Create a new isekai project from [template] or @isekai/template`,
    alias: [ `init` ],
    
    handler: ({
        template = `@isekai/template`,
        name = `isekai_project`
    }) => 
        degit(template).
            clone(name)
    
});