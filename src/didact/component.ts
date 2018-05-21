import { scheduleUpdate } from "./fiber";
import { Fiber, DidactFiberElementProps } from "./models";

export abstract class Component {
    __fiber: Fiber;
    state: any;
    props: DidactFiberElementProps;

    constructor(props: DidactFiberElementProps) {
        this.props = props;
        this.state = this.state || {};
    }

    setState = (partialState: any) => {
        scheduleUpdate(this, partialState);
    }

    abstract render() : Fiber[]
}

export function createInstance(fiber: Fiber): Component {
    const instance = unsafeCreateInstance(fiber.type, fiber.props);
    instance.__fiber = fiber;
    return instance;
}

function unsafeCreateInstance(type: any, props: DidactFiberElementProps): Component {
    return new type(props);
}