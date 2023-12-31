import './assets/main.css'
import "./assets/tailwindcss.css"
import Antd from 'ant-design-vue';

import { createApp } from 'vue'
import App from './App.vue'

import 'ant-design-vue/dist/reset.css';


const app = createApp(App);

app.use(Antd).mount('#app');