import { Fiber, FiberProps, FiberTag, EffectTag } from "./models";
import { Component, createInstance } from "./component";
import { createDomElement, updateDomProperties } from "./dom-utils";

type RequestIdleCallbackHandle = any;
type RequestIdleCallbackOptions = {
    timeout: number;
};
type RequestIdleCallbackDeadline = {
    readonly didTimeout: boolean;
    timeRemaining: (() => number);
};

declare global {
    interface Window {
        requestIdleCallback: ((
            callback: ((deadline: RequestIdleCallbackDeadline) => void),
            opts?: RequestIdleCallbackOptions,
        ) => RequestIdleCallbackHandle);
        cancelIdleCallback: ((handle: RequestIdleCallbackHandle) => void);
    }
    interface HTMLElement {
        _rootContainerFiber: Fiber
    }
}

const ENOUGH_TIME = 1;

class HostRootQueueItem {
    public constructor(init?: HostRootQueueItem) {
        Object.assign(this, init);
    }
    dom: HTMLElement = null;
    newProps: FiberProps = null;
}

class ClassComponentQueueItem {
    public constructor(init?: ClassComponentQueueItem) {
        Object.assign(this, init);
    }
    instance: Component = null;
    partialState: any;
}

const updateQueue: (HostRootQueueItem|ClassComponentQueueItem)[] = [];
let nextUnitOfWork: Fiber = null;
let pendingCommit = null;

export function render(elements: Fiber[], containerDom: HTMLElement) {
    updateQueue.push(new HostRootQueueItem ({
        dom: containerDom,
        newProps: { children: elements }
    }));
    window.requestIdleCallback(performWork);
}

export function scheduleUpdate(component: Component, partialState: any) {
    updateQueue.push(new ClassComponentQueueItem({
        instance: component,
        partialState: partialState
    }));
    window.requestIdleCallback(performWork);
}

function performWork(deadline: RequestIdleCallbackDeadline) : void {
    workLoop(deadline);
    if (nextUnitOfWork || updateQueue.length > 0) {
        window.requestIdleCallback(performWork);
    }
}

function workLoop(deadline: RequestIdleCallbackDeadline) {
    if (!nextUnitOfWork) {
        resetNextUnitOfWork();
    }
    while(nextUnitOfWork && deadline.timeRemaining() > ENOUGH_TIME) {
        nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    }
    if (pendingCommit) {
        commitAllWork(pendingCommit);
    }
}

function resetNextUnitOfWork() {
    const update = updateQueue.shift();
    if (!update) {
        return;
    }

    if (update instanceof ClassComponentQueueItem && update.partialState) {
        update.instance.__fiber.partialState = update.partialState;
    }

    if (update instanceof HostRootQueueItem) {
        nextUnitOfWork = new Fiber({
            tag: FiberTag.HOST_ROOT,
            domStateNode: update.dom,
            props: update.newProps,
            alternate: update.dom._rootContainerFiber
        });
    } else {
        const root = getRoot(update.instance.__fiber);
        nextUnitOfWork = new Fiber({
            tag: FiberTag.HOST_ROOT,
            componentStateNode: root.componentStateNode,
            domStateNode: root.domStateNode,
            props: root.props,
            alternate: root
        });
    }
}

function getRoot(fiber: Fiber) : Fiber {
    let node = fiber;
    while (node.parent) {
        node = node.parent;
    }
    return node;
}

function performUnitOfWork(nextUnitOfWork: Fiber): Fiber {
    beginWork(nextUnitOfWork);
    if (nextUnitOfWork.child) {
        return nextUnitOfWork.child;
    }
    let uow = nextUnitOfWork;
    while (uow) {
        completeWork(uow);
        if (uow.sibling) {
            return uow.sibling;
        }
        uow = uow.parent;
    }
}

function beginWork(nextUnitOfWork: Fiber): void {
    if (nextUnitOfWork.tag === FiberTag.CLASS_COMPONENT) {
        updateClassComponent(nextUnitOfWork);
    }
    else {
        updateHostComponent(nextUnitOfWork);
    }
}

function updateHostComponent(nextUnitOfWork: Fiber): void {
    if (!nextUnitOfWork.domStateNode) {
        nextUnitOfWork.domStateNode = createDomElement(nextUnitOfWork);
    }
    const newChildElements = nextUnitOfWork.props.children;
    reconcileChildrenArray(nextUnitOfWork, newChildElements);
}

function updateClassComponent(nextUnitOfWork: Fiber): void {
    let instance = nextUnitOfWork.componentStateNode;
    if (instance == null) {
        // Call class constructor
        instance = nextUnitOfWork.componentStateNode = createInstance(nextUnitOfWork);
    } else if (nextUnitOfWork.props === instance.props && !nextUnitOfWork.partialState) {
        // No need to render, clone children from last time
        cloneChildFibers(nextUnitOfWork);
        return;
    }

    instance.props = nextUnitOfWork.props;
    instance.state = Object.assign({}, instance.state, nextUnitOfWork.partialState);
    nextUnitOfWork.partialState = null;

    const newChildElements = nextUnitOfWork.componentStateNode.render();
    reconcileChildrenArray(nextUnitOfWork, newChildElements);
}

function arrify(val) {
    return val == null ? [] : Array.isArray(val) ? val : [val];
}

function reconcileChildrenArray(nextUnitOfWork: Fiber, children: Fiber[]) : void {
    const elements = arrify(children);

    let index = 0;
    let oldFiber : Fiber = nextUnitOfWork.alternate ? nextUnitOfWork.alternate.child : null;
    let newFiber : Fiber = null;

    while (index < elements.length || oldFiber != null) {
        const prevFiber = newFiber;
        const element = index < elements.length && elements[index];
        const sameType = oldFiber && element && element.type == oldFiber.type;

        if (sameType) {
            newFiber = new Fiber({
                type: oldFiber.type,
                tag: oldFiber.tag,
                domStateNode: oldFiber.domStateNode,
                componentStateNode: oldFiber.componentStateNode,
                props: element.props,
                parent: nextUnitOfWork,
                alternate: oldFiber,
                partialState: oldFiber.partialState,
                effectTag: EffectTag.UPDATE
            });
        }

        if (element && !sameType) {
            newFiber = new Fiber({
                type: element.type,
                tag:
                    typeof element.type === "string" ? FiberTag.HOST_COMPONENT : FiberTag.CLASS_COMPONENT,
                props: element.props,
                parent: nextUnitOfWork,
                effectTag: EffectTag.PLACEMENT
            });
        }

        if (oldFiber && !sameType) {
            oldFiber.effectTag = EffectTag.DELETION;
            nextUnitOfWork.effects = nextUnitOfWork.effects || [];
            nextUnitOfWork.effects.push(oldFiber);
        }

        if (oldFiber) {
            oldFiber = oldFiber.sibling;
        }

        if (index == 0) {
            nextUnitOfWork.child = newFiber;
        } else if (prevFiber && element) {
            prevFiber.sibling = newFiber;
        }

        index++;
    }
}

function cloneChildFibers(parentFiber: Fiber): void {
    const oldFiber = parentFiber.alternate;
    if (!oldFiber || !oldFiber.child) {
        return;
    }

    let oldChild = oldFiber.child;
    let prevChild : Fiber = null;
    while (oldChild) {
        const newChild : Fiber = new Fiber({
            type: oldChild.type,
            tag: oldChild.tag,
            domStateNode: oldChild.domStateNode,
            componentStateNode: oldChild.componentStateNode,
            props: oldChild.props,
            partialState: oldChild.partialState,
            alternate: oldChild,
            parent: parentFiber
        });
        if (prevChild) {
            prevChild.sibling = newChild;
        } else {
            parentFiber.child = newChild;
        }
        prevChild = newChild;
        oldChild = oldChild.sibling;
    }
}

function completeWork(fiber: Fiber): void {
    if (fiber.tag === FiberTag.CLASS_COMPONENT) {
        fiber.componentStateNode.__fiber = fiber;
    }
    if (fiber.parent) {
        const childEffects = fiber.effects || [];
        const thisEffect = fiber.effectTag != null ? [fiber] : [];
        const parentEffects = fiber.parent.effects || [];
        fiber.parent.effects = parentEffects.concat(childEffects, thisEffect);
    } 
    else {
        pendingCommit = fiber;
    }
}

function commitAllWork(fiber: Fiber): void {
    fiber.effects.forEach(commitWork);
    (fiber.domStateNode as HTMLElement)._rootContainerFiber = fiber;
    nextUnitOfWork = null;
    pendingCommit = null;
}

function commitWork(fiber: Fiber): void {
    if (fiber.tag === FiberTag.HOST_ROOT) {
        return;
    }
    let domParentFiber = fiber.parent;
    while (domParentFiber.tag === FiberTag.CLASS_COMPONENT) {
        domParentFiber = domParentFiber.parent;
    }
    const domParent = domParentFiber.domStateNode;

    if (fiber.effectTag === EffectTag.PLACEMENT && fiber.tag === FiberTag.HOST_COMPONENT) {
        (domParent as HTMLElement).appendChild(fiber.domStateNode as HTMLElement);
    } else if (fiber.effectTag === EffectTag.UPDATE) {
        updateDomProperties(fiber.domStateNode, fiber.alternate.props, fiber.props);
    } else if (fiber.effectTag === EffectTag.DELETION) {
        commitDeletion(fiber, domParent as HTMLElement);
    }
}

function commitDeletion(fiber : Fiber, domParent: HTMLElement) {
    let node = fiber;
    while (true) {
        if (node.tag === FiberTag.CLASS_COMPONENT) {
            node = node.child;
            continue;
        }
        domParent.removeChild(node.domStateNode);
        while (node !== fiber && !node.sibling) {
            node = node.parent;
        }
        if (node === fiber) {
            return;
        }
        node = node.sibling;
    }
}