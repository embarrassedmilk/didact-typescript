export interface DomInstance {
    dom: HTMLElement,
    element: DidactElement,
    childInstances: DomInstance[]
}

export interface DidactElementProps {
    children: DidactElement[],
    [propName: string]: any
}

export interface DidactElement {
    type: string, 
    props: DidactElementProps
};