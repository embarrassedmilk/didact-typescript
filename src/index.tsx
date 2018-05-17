/** @jsx app.createElement */
import { Didact } from "./didact/didact";

const rootDom = document.getElementById("root");

const app = Didact();

function tick() {
    const time = new Date().toLocaleTimeString();
    const clockElement = <h1>{time}</h1>;
    app.render(clockElement, rootDom as HTMLElement);
}

tick();
setInterval(tick, 1000);