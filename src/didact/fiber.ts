import { Fiber, DidactFiberElementProps, FiberTag, EffectTag } from "./models";
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
    from: FiberTag = FiberTag.HOST_ROOT;
    dom: HTMLElement = null;
    newProps: DidactFiberElementProps = null;
}

class ClassComponentQueueItem {
    public constructor(init?: ClassComponentQueueItem) {
        Object.assign(this, init);
    }
    from: FiberTag = FiberTag.CLASS_COMPONENT;
    instance: Component = null;
    partialState: any;
}

const updateQueue: (HostRootQueueItem|ClassComponentQueueItem)[] = [];
let nextUnitOfWork: Fiber = null;
let pendingCommit = null;

export function render(elements: Fiber[], containerDom: HTMLElement) {
    updateQueue.push(new HostRootQueueItem ({
        from: FiberTag.HOST_ROOT,
        dom: containerDom,
        newProps: { children: elements }
    }));
    window.requestIdleCallback(performWork);
}

export function scheduleUpdate(component: Component, partialState: any) {
    updateQueue.push(new ClassComponentQueueItem({
        from: FiberTag.CLASS_COMPONENT,
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

    const root =
        update instanceof HostRootQueueItem
            ? update.dom._rootContainerFiber
            : getRoot(update.instance.__fiber);

    nextUnitOfWork = new Fiber({
        tag: FiberTag.HOST_ROOT,
        stateNode: update instanceof HostRootQueueItem ? update.dom : root.stateNode,
        props: update instanceof HostRootQueueItem ? update.newProps : root.props,
        alternate: root
    });
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
    if (!nextUnitOfWork.stateNode) {
        nextUnitOfWork.stateNode = createDomElement(nextUnitOfWork);
    }
    const newChildElements = nextUnitOfWork.props.children;
    reconcileChildrenArray(nextUnitOfWork, newChildElements);
}

function updateClassComponent(nextUnitOfWork: Fiber): void {
    let instance = nextUnitOfWork.stateNode as Component;
    if (instance == null) {
        // Call class constructor
        instance = nextUnitOfWork.stateNode = createInstance(nextUnitOfWork);
    } else if (nextUnitOfWork.props === instance.props && !nextUnitOfWork.partialState) {
        // No need to render, clone children from last time
        cloneChildFibers(nextUnitOfWork);
        return;
    }

    instance.props = nextUnitOfWork.props;
    instance.state = Object.assign({}, instance.state, nextUnitOfWork.partialState);
    nextUnitOfWork.partialState = null;

    const newChildElements = (nextUnitOfWork.stateNode as Component).render();
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
                stateNode: oldFiber.stateNode,
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
            stateNode: oldChild.stateNode,
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
        (fiber.stateNode as Component).__fiber = fiber;
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
    (fiber.stateNode as HTMLElement)._rootContainerFiber = fiber;
    nextUnitOfWork = null;
    pendingCommit = null;
}

function commitWork(fiber: Fiber): void {
    if (fiber.tag == FiberTag.HOST_ROOT) {
        return;
    }
    let domParentFiber = fiber.parent;
    while (domParentFiber.tag === FiberTag.CLASS_COMPONENT) {
        domParentFiber = domParentFiber.parent;
    }
    const domParent = domParentFiber.stateNode;

    if (fiber.effectTag === EffectTag.PLACEMENT && fiber.tag == FiberTag.HOST_COMPONENT) {
        (domParent as HTMLElement).appendChild(fiber.stateNode as HTMLElement);
    } else if (fiber.effectTag === EffectTag.UPDATE) {
        updateDomProperties(fiber.stateNode as HTMLElement | Text, fiber.alternate.props, fiber.props);
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
        domParent.removeChild(node.stateNode as HTMLElement | Text);
        while (node !== fiber && !node.sibling) {
            node = node.parent;
        }
        if (node === fiber) {
            return;
        }
        node = node.sibling;
    }
}