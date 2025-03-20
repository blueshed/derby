import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './routes'
import stores from './stores'

createApp(App).use(router).use(stores).mount('#app')
