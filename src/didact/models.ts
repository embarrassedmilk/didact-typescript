export interface DidactInstance {
    dom: HTMLElement,
    element: DidactElement,
    childInstances: DidactInstance[]
}

export interface DidactElementProps {
    children: DidactElement[],
    [propName: string]: any
}

export interface DidactElement {
    type: string, 
    props: DidactElementProps
};