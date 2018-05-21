export function createElement(type : string, config : any, ...args : any[]) {
    const props = Object.assign({}, config);
    const hasChildren = args.length > 0;
    const rawChildren = hasChildren ? [].concat(...args) : [];
    props.children = rawChildren
        .filter(c => c != null && c !== false)
        .map(c => c instanceof Object ? c : createTextElement(c));
    return { type, props };
}

function createTextElement(value) {
    return createElement("TEXT_ELEMENT", { nodeValue: value });
}