import { DidactElement, DidactInstance, DidactElementProps } from "./models";
import { TEXT_NODE } from "./constants";

export function Didact() {
    let rootInstance = null;

    function render(element: DidactElement, container: HTMLElement) {
        const prevInstance = rootInstance;
        const nextInstance = reconcile(container, prevInstance, element);
        rootInstance = nextInstance;
    }

    function createTextElement(value : string) {
        return createElement(TEXT_NODE, { nodeValue: value });
    }

    function reconcile(parentDom: HTMLElement, instance: DidactInstance, element: DidactElement) : DidactInstance {
        if (element == null) {
            parentDom.removeChild(instance.dom);
            return null;
        }
        
        if (instance && instance.element.type === element.type) {
            updateDomProperties(instance.dom, instance.element.props, element.props);
            instance.childInstances = reconcileChildren(instance, element);
            instance.element = element;
            return instance;
        }
        
        const newInstance = instantiate(element);
        
        instance === null
            ? parentDom.appendChild(newInstance.dom)
            : parentDom.replaceChild(newInstance.dom, instance.dom)
        
        return newInstance;
    }

    function reconcileChildren(instance: DidactInstance, element: DidactElement) : DidactInstance[] {
        const dom = instance.dom;
        const childInstances = instance.childInstances;
        const nextChildElements = element.props.children || [];
        const newChildInstances = [];
        const count = Math.max(childInstances.length, nextChildElements.length);
        for (let i = 0; i < count; i++) {
            const childInstance = childInstances[i];
            const childElement = nextChildElements[i];
            const newChildInstance = reconcile(dom, childInstance, childElement);
            newChildInstances.push(newChildInstance);
        }
        return newChildInstances.filter(instance => instance != null);
    }

    function instantiate(element: DidactElement) : DidactInstance {
        const { type, props } = element;
        const isTextNode = type === TEXT_NODE;

        const dom = isTextNode
            ? <any>document.createTextNode("")
            : document.createElement(type);

        updateDomProperties(dom, { children: [] }, props);

        const childElements = props.children || [];
        const childInstances = childElements.map(instantiate);
        const childDoms = childInstances.map((instance: DidactInstance) => instance.dom)
        childDoms.forEach((childDom: HTMLElement) => dom.appendChild(childDom));

        const instance = { dom, element, childInstances };
        return instance;
    }

    function updateDomProperties(dom: HTMLElement, prevProps: DidactElementProps, nextProps: DidactElementProps) {
        const isListener = (name: string) => name.startsWith("on");
        const isAttribute = (name: string) => !isListener(name) && name !== "children";

        Object.keys(nextProps).filter(isListener).forEach((name: string) => {
            const eventType = name.toLowerCase().substring(2);
            dom.removeEventListener(eventType, nextProps[name]);
        });

        Object.keys(nextProps).filter(isAttribute).forEach((name: string) => {
            dom[name] = null;
        });

        Object.keys(nextProps).filter(isListener).forEach((name: string) => {
            const eventType = name.toLowerCase().substring(2);
            dom.addEventListener(eventType, nextProps[name]);
        });

        Object.keys(nextProps).filter(isAttribute).forEach((name: string) => {
            dom[name] = nextProps[name]
        });
    }

    function createElement(type: string, config: any, ...args: any[]) {
        const props = Object.assign({}, config);
        const hasChildren = args.length > 0;
        const rawChildren = hasChildren ? [].concat(...args) : [];
        
        props.children = 
            rawChildren
                .filter(child => child != null && child !== false)
                .map((c:any) => c instanceof Object ? c : createTextElement(c))
        
        return { type, props };
    }

    return {
        render,
        createElement
    };
}
