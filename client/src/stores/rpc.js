import { reactive, inject } from "vue";

export function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

const websocket_url = (path = "/websocket") => {
    if (import.meta.env.MODE == "development") {
        return `ws://localhost:8080${path}`;
    }
    // determine the websocket url.
    const protocol = location.protocol === "https:" ? "wss://" : "ws://";
    return `${protocol}${location.hostname}:${location.port}${path}`;
};

/**
 * set the cookie for re-authentication
 **/
const set_cookie = (cname, cvalue, exdays = 7) => {
    if (cvalue) {
        const d = new Date();
        d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
        const expires = "expires=" + d.toUTCString();
        document.cookie = `${cname}=${cvalue};${expires};path=/`;
        console.debug("cookie set");
    } else {
        document.cookie = `${cname}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        console.debug("cookie cleared");
    }
};
const NOTSET = "not-set";

class Rpc {
    static CONNECTED = "connected";
    static CLOSED = "disconnected";
    static STORES = [];

    constructor(state, path) {
        this.notify = [];
        this.state =
            state ||
            reactive({
                status: Rpc.CLOSED,
                broadcast: null,
                profile: NOTSET,
                error: null,
            });
        this.path = path;
        this.id = 1;
        this.promises = {};
        this.ws = null;
        this.api = new Proxy(this, {
            get(target, property) {
                if (property == "toJSON") return undefined;
                return (args = {}) => {
                    if (this.connected === false) {
                        throw "Not Connected";
                    }
                    return new Promise((resolve, reject) => {
                        target.promises[++target.id] = { resolve, reject };
                        if (!target.ws) {
                            throw "Not connected";
                        }
                        target.ws.send(
                            JSON.stringify({
                                jsonrpc: "2.0",
                                id: target.id,
                                method: property,
                                params: args,
                            }),
                        );
                    });
                };
            },
            set(target, property, value) { },
        });
    }
    get next_id() {
        return ++this.id;
    }
    get status() {
        return this.state.status;
    }
    get connected() {
        return this.state.status == Rpc.CONNECTED;
    }
    get error() {
        return this.state.error;
    }
    set error(value) {
        if (value) {
            console.error(value);
        }
        this.state.error = value;
        return value;
    }
    connect() {
        this.state.error = null;
        if (this.ws) {
            throw "Already connected";
        }
        let connect_promise = new Promise((resolve, reject) => {
            let ws = new WebSocket(websocket_url(this.path));
            ws.onopen = () => {
                this.state.status = Rpc.CONNECTED;
                resolve(this);
                connect_promise = null;
                this.notify.map((func) => func());
                this.notify = [];
            };
            ws.onclose = () => {
                this.ws = null;
                this.state.status = Rpc.CLOSED;
                if (connect_promise) {
                    reject(this.error);
                    connect_promise = null;
                }
            };
            ws.onerror = (error) => {
                this.error = error;
            };
            ws.onmessage = (evt) => {
                const message = JSON.parse(evt.data);
                if (message.id) {
                    const promise = this.promises[message.id];
                    if (message.error) {
                        promise.reject(message.error);
                    } else {
                        promise.resolve(message.result);
                    }
                } else {
                    if (message.action == "profile") {
                        if (message.cookie_name) {
                            set_cookie(message.cookie_name, message.cookie);
                        }
                        this.state.profile = message.args;
                    } else {
                        this.state.broadcast = message;
                        if (message.action) {
                            Rpc.STORES.forEach((store) => {
                                if (
                                    store[message.action] &&
                                    typeof store[message.action] == "function"
                                ) {
                                    store[message.action](message.args);
                                }
                            });
                        }
                        if (message.stream_id) {
                            Rpc.STORES.forEach((store) => {
                                if (store.stream && typeof store.stream == "function") {
                                    store.stream(message);
                                }
                            });
                        }
                    }
                }
            };
            this.ws = ws;
        });
        return connect_promise;
    }
    disconnect() {
        return this.ws ? this.ws.close() : null;
    }
    toggle_connect() {
        if (this.state.status == Rpc.CONNECTED) {
            this.disconnect();
        } else {
            this.connect();
        }
    }
    on_loaded(func) {
        if (this.connected) {
            func();
        } else {
            this.notify.push(func);
        }
    }
}

const RPC_KEY = "rpc";

export const useRpc = () => {
    return inject(RPC_KEY);
};

export const createRpc = (state = null, url = "/ws") => {
    const rpc = (window.rpc = new Rpc(state, url));
    return {
        install(app, options) {
            app.provide(RPC_KEY, rpc);
            rpc.connect();
        },
    };
};

export const piniaRpc = ({ store }) => {
    store.$rpc = useRpc();
    Rpc.STORES.push(store);
};
