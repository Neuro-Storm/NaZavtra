import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'
import './vendor/vue-flow-style.css'
import './vendor/vue-flow-theme-default.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
