import { TEXT_NODE } from "./constants";

export function importDidact() {
    abstract class Component {
        __internalInstance: DomInstance | ComponentInstance;
        state: any;
        props: any;

        constructor(props: any) {
            this.props = props;
            this.state = this.state || {};
        }

        setState = (partialState: any) => {
            this.state = Object.assign({}, this.state, partialState);
            updateInstance(this.__internalInstance);
        }

        abstract render(): DidactElement
    }

    interface ComponentInstance {
        dom: HTMLElement,
        element: DidactElement,
        childInstance: DomInstance | ComponentInstance,
        publicInstance: Component
    };

    interface DomInstance {
        dom: HTMLElement,
        element: DidactElement,
        childInstances: (DomInstance | ComponentInstance)[]
    }

    interface DidactElementProps {
        children: DidactElement[],
        [propName: string]: any
    }

    interface DidactElement {
        type: string,
        props: DidactElementProps
    };

    let rootInstance = null;

    function render(element: DidactElement, container: HTMLElement) {
        const prevInstance = rootInstance;
        const nextInstance = reconcile(container, prevInstance, element);
        rootInstance = nextInstance;
    }

    function createTextElement(value : string) {
        return createElement(TEXT_NODE, { nodeValue: value });
    }

    function reconcile(parentDom: HTMLElement, instance: DomInstance | ComponentInstance, element: DidactElement) : DomInstance | ComponentInstance {
        if (instance == null) {
            // Create instance
            const newInstance = instantiateWhatever(element);
            parentDom.appendChild(newInstance.dom);
            return newInstance;
        } else if (element == null) {
            // Remove instance
            parentDom.removeChild(instance.dom);
            return null;
        } else if (instance.element.type !== element.type) {
            // Replace instance
            const newInstance = instantiateWhatever(element);
            parentDom.replaceChild(newInstance.dom, instance.dom);
            return newInstance;
        } else if (typeof element.type === "string") {
            // Update dom instance
            const domInstance = instance as DomInstance;
            updateDomProperties(instance.dom, instance.element.props, element.props);
            domInstance.childInstances = reconcileChildren(domInstance, element);
            instance.element = element;
            return instance;
        } else {
            //Update component instance
            const componentInstance = instance as ComponentInstance;
            componentInstance.publicInstance.props = element.props;
            const childElement = componentInstance.publicInstance.render();
            const oldChildInstance = componentInstance.childInstance;
            const childInstance = reconcile(parentDom, oldChildInstance, childElement) as ComponentInstance;
            instance.dom = childInstance.dom;
            componentInstance.childInstance = childInstance;
            instance.element = element;
            return instance;
        }
    }

    function reconcileChildren(instance: DomInstance, element: DidactElement) : (DomInstance | ComponentInstance)[] {
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

    function instantiateWhatever(element: DidactElement): DomInstance | ComponentInstance {
        const { type, props } = element;
        const isDomElement = typeof type === "string";
        if (isDomElement) {
            return instantiateDomInstance(element);
        }
        else {
            return instantiateComponentInstance(element);
        }
    }

    function instantiateDomInstance(element: DidactElement) : DomInstance {
        const { type, props } = element;

        const isTextNode = type === TEXT_NODE;

        const dom = isTextNode
            ? <any>document.createTextNode("")
            : document.createElement(type);

        updateDomProperties(dom, { children: [] }, props);

        const childElements = props.children || [];
        const childInstances = childElements.map(instantiateWhatever);
        const childDoms = childInstances.map((instance: (DomInstance | ComponentInstance)) => instance.dom)
        childDoms.forEach((childDom: HTMLElement) => dom.appendChild(childDom));

        const instance = { dom, element, childInstances };
        return instance;
    }

    function instantiateComponentInstance(element: DidactElement): ComponentInstance {
        const { type, props } = element;

        const instance = { dom: null, element: null, childInstance: null, publicInstance: null };
        const publicInstance = createPublicInstance(element, instance);
        const childElement = publicInstance.render();
        const childInstance = instantiateWhatever(childElement);
        const dom = childInstance.dom;

        Object.assign(instance, { dom, element, childInstance, publicInstance });

        return instance;
    }

    function createPublicInstance(element: DidactElement, internalInstance: ComponentInstance): Component {
        const { type, props } = element;
        const publicInstance = unsafeCreateInstance(type, props);
        publicInstance.__internalInstance = internalInstance;
        return publicInstance;
    }

    function unsafeCreateInstance(type: any, props: DidactElementProps) : any {
        return new type(props);
    }

    function updateInstance(internalInstance: DomInstance | ComponentInstance) {
        const parentDom = internalInstance.dom.parentNode;
        const element = internalInstance.element;
        reconcile(parentDom as HTMLElement, internalInstance, element);
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
        createElement,
        Component
    };
}
