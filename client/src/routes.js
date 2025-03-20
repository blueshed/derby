import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
    history: createWebHashHistory(),
    linkActiveClass: "menu-active",
    routes: [
        {
            path: '/',
            component: () => import('./views/Home.vue'),
        },
    ],
})

export default router