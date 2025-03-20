import { createPinia } from "pinia";
import { createRpc, piniaRpc } from "./rpc";

export default {
    install(app, options) {
        const pinia = createPinia();
        app.use(pinia);
        app.use(createRpc());
        pinia.use(piniaRpc);
    },
};
