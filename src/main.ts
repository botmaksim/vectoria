import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

// Configure MathLive fonts path
// Configure MathLive fonts path
window.MathfieldElement = window.MathfieldElement || {};
window.MathfieldElement.fontsDirectory = '/mathlive-fonts';

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
