import { render } from "./didact/didact";

const rootDom = document.getElementById("root");

function tick() {
    const time = new Date().toLocaleTimeString();
    const clockElement = <h1>{time}</h1>;
    render(clockElement, rootDom as HTMLElement);
}

tick();
setInterval(tick, 1000);