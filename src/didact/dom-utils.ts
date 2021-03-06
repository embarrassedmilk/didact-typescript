import { FiberProps, Fiber } from "./models";

const isEvent = (name: string) : boolean => 
    name.startsWith("on");

const isAttribute = (name: string) : boolean => 
    !isEvent(name) && name !== "children" && name !== "style";

const isNew = (prev: FiberProps, next: FiberProps): (key: string) => boolean => 
   key => 
        prev[key] !== next[key];

const isGone = (prev: FiberProps, next: FiberProps): (key: string) => boolean => 
    key => 
        !(key in next);

export function updateDomProperties(dom: HTMLElement | Text, prevProps: FiberProps, nextProps: FiberProps) {
    // Remove event listeners
    Object.keys(prevProps)
        .filter(isEvent)
        .filter(key => isGone(prevProps, nextProps)(key))
        .forEach(name => {
            const eventType = name.toLowerCase().substring(2);
            dom.removeEventListener(eventType, prevProps[name]);
        });

    // Remove attributes
    Object.keys(prevProps)
        .filter(isAttribute)
        .filter(isGone(prevProps, nextProps))
        .forEach(name => {
            dom[name] = null;
        });

    // Set attributes
    Object.keys(nextProps)
        .filter(isAttribute)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            dom[name] = nextProps[name];
        });

    if (dom instanceof HTMLElement) {
        // Set style
        prevProps.style = prevProps.style || {};
        nextProps.style = nextProps.style || {};
        Object.keys(nextProps.style)
            .filter(isNew(prevProps.style, nextProps.style))
            .forEach(key => {
                dom.style[key] = nextProps.style[key];
            });

        Object.keys(prevProps.style)
            .filter(isGone(prevProps.style, nextProps.style))
            .forEach(key => {
                dom.style[key] = "";
            });
    }
    
    // Add event listeners
    Object.keys(nextProps)
        .filter(isEvent)
        .filter(isNew(prevProps, nextProps))
        .forEach(name => {
            const eventType = name.toLowerCase().substring(2);
            dom.addEventListener(eventType, nextProps[name]);
        });
}

export function createDomElement(fiber: Fiber) : HTMLElement | Text {
    const isTextElement = fiber.type === "TEXT_ELEMENT";
    const dom = isTextElement
        ? document.createTextNode("")
        : document.createElement(fiber.type);
    updateDomProperties(dom, { children: [] }, fiber.props);
    return dom;
}