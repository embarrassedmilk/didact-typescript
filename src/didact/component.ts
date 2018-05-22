import { scheduleUpdate } from "./fiber";
import { Fiber, FiberProps } from "./models";

export abstract class Component {
    __fiber: Fiber;
    state: any;
    props: FiberProps;

    constructor(props: FiberProps) {
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

function unsafeCreateInstance(type: any, props: FiberProps): Component {
    return new type(props);
}