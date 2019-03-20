export default ({
    set
}) => {
    set({
        BROWSER_BIFROST: (path) => {
            const signal_sets = new Set();
        
            const eventStream = new EventSource(`${path}/CLIENT_VERSION`);
        
            eventStream.onmessage = ({ data: raw }) => {  
                const {
                    signal,
                    data
                } = JSON.parse(raw);
                
                signal_sets.forEach((signals) => {
                    if(signals[signal]) {
                        signals[signal]({ data });
                    }
                });
            };
        
            const send = (call) => 
                fetch(`/divine`, {
                    method: `POST`,
                    cache: `no-cache`,
                    headers: {
                        "Content-Type": `application/json; charset=utf-8`,
                    },
                    body: JSON.stringify(call)
                });
        
            return Object.assign(send, {
                on: (new_signals) => {
                    signal_sets.add(new_signals);
                } 
            });
        }
    });
};
