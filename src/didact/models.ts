import { Component } from "./component";

export interface DidactFiberElementProps {
    children: Fiber[],
    [propName: string]: any
}

export enum FiberTag {
    HOST_COMPONENT,
    CLASS_COMPONENT,
    HOST_ROOT
}

export enum EffectTag {
    PLACEMENT,
    UPDATE,
    DELETION
}

export class Fiber {
    public constructor(init?: Fiber) {
        Object.assign(this, init);
    }

    tag: FiberTag;
    stateNode?: Component | (HTMLElement | Text) = null
    props?: DidactFiberElementProps = null;
    alternate?: Fiber = null;
    type?: string = "";
    parent?: Fiber = null;
    child?: Fiber = null;
    sibling?: Fiber = null;
    partialState?: any = null;
    effectTag?: EffectTag = null;
    effects?: Fiber[] = [];
}
