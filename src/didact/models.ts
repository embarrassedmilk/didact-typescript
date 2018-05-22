import { Component } from "./component";

export interface FiberProps {
    children: Fiber[],
    [propName: string]: any
}

export enum FiberTag {
    HOST_COMPONENT,
    CLASS_COMPONENT,
    HOST_ROOT
}

export enum EffectTag {
    None = "None",
    PLACEMENT = "PLACEMENT",
    UPDATE = "UPDATE",
    DELETION = "DELETION"
}

export class Fiber {
    public constructor(init?: Fiber) {
        Object.assign(this, init);
    }

    tag: FiberTag;
    componentStateNode?: Component = null
    domStateNode?: (HTMLElement | Text) = null
    props?: FiberProps = null;
    alternate?: Fiber = null;
    type?: string = "";
    parent?: Fiber = null;
    child?: Fiber = null;
    sibling?: Fiber = null;
    partialState?: any = null;
    effectTag?: EffectTag = null;
    effects?: Fiber[] = [];
}
