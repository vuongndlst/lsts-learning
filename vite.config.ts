import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:'/lsts-learning/',server:{port:8765,strictPort:true}});
