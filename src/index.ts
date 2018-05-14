import { DidactElement } from "./models";
import { TEXT_NODE } from "./constants";

export function render(element: DidactElement, parentDom: HTMLElement) {
    const { type, props } = element;
    const isTextNode = type === TEXT_NODE;

    const dom = isTextNode 
        ? <any>document.createTextNode("")
        : document.createElement(type);

    const isListener = (name: string) => name.startsWith("on");
    Object.keys(props).filter(isListener).forEach((name: string) => {
        const eventType = name.toLowerCase().substring(2);
        dom.addEventListener(eventType, <EventListenerOrEventListenerObject>props[name]);
    });

    const isAttribute = (name: string) => !isListener(name) && name !== "children";
    Object.keys(props).filter(isAttribute).forEach((name: string) => {
        dom.setAttribute(name, props[name]);
    });

    const childElements = props.children || [];
    childElements.forEach((childElement : DidactElement) => render(childElement, dom));

    parentDom.appendChild(dom);
}

function createTextElement(value : string) {
    return createElement(TEXT_NODE, { nodeValue: value });
}

export function createElement(type: string, config: any, ...args: any[]) {
    const props = Object.assign({}, config);
    const hasChildren = args.length > 0;
    const rawChildren = hasChildren ? [].concat(...args) : [];
    
    props.children = 
        rawChildren
            .filter(child => child !== null && child !== false)
            .map((c:any) => c instanceof Object ? c : createTextElement(c))
    
    return { type, props };
}