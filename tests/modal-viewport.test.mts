import assert from "node:assert/strict";
import { test } from "node:test";
import { trackModalViewport } from "../modal/util/viewport.ts";

class Viewport extends EventTarget {
    offsetTop = 0;
    height = 844;
}

class TestWindow extends EventTarget {
    innerHeight = 828;
    visualViewport = new Viewport();
    frameElement: object | null = null;
    callbacks = new Map<number, FrameRequestCallback>();
    nextId = 0;

    requestAnimationFrame(callback: FrameRequestCallback) {
        const id = ++this.nextId;
        this.callbacks.set(id, callback);
        return id;
    }

    cancelAnimationFrame(id: number) {
        this.callbacks.delete(id);
    }

    flush() {
        const callbacks = [...this.callbacks.values()];
        this.callbacks.clear();
        for (const callback of callbacks) callback(0);
    }
}

function setup() {
    const host = new TestWindow();
    host.innerHeight = 844;
    const frameWindow = new TestWindow();
    let frameTop = 8;
    frameWindow.frameElement = {
        ownerDocument: { defaultView: host },
        clientTop: 0,
        getBoundingClientRect: () => ({ top: frameTop }),
    };
    const previousWindow = globalThis.window;
    globalThis.window = frameWindow as unknown as Window & typeof globalThis;

    const properties = new Map<string, string>();
    const dialog = {
        style: { setProperty: (name: string, value: string) => properties.set(name, value) },
    } as unknown as HTMLDialogElement;

    return {
        host,
        frameWindow,
        dialog,
        top: () => Number.parseFloat(properties.get("--silversearch-viewport-top")!),
        height: () => Number.parseFloat(properties.get("--silversearch-viewport-height")!),
        moveFrame: (top: number) => { frameTop = top; },
        restore: () => { globalThis.window = previousWindow; },
    };
}

test("reopening after keyboard panning uses the current host viewport", () => {
    const scenario = setup();
    try {
        const closeFirst = trackModalViewport(scenario.dialog);
        assert.equal(scenario.top(), 0);
        assert.equal(scenario.height(), 828);
        closeFirst();

        // The iframe still reports a full viewport while its parent is panned.
        scenario.host.visualViewport.offsetTop = 180;
        scenario.host.visualViewport.height = 420;
        const closeSecond = trackModalViewport(scenario.dialog);
        assert.equal(scenario.top(), 172);
        assert.equal(scenario.height(), 420);
        closeSecond();
    } finally {
        scenario.restore();
    }
});

test("scroll and resize keep the dialog inside the host's visible area", () => {
    const scenario = setup();
    try {
        const close = trackModalViewport(scenario.dialog);
        scenario.host.visualViewport.offsetTop = 180;
        scenario.host.visualViewport.height = 420;
        scenario.host.visualViewport.dispatchEvent(new Event("scroll"));
        scenario.host.visualViewport.dispatchEvent(new Event("resize"));
        assert.equal(scenario.frameWindow.callbacks.size, 1);
        scenario.frameWindow.flush();
        assert.equal(scenario.top(), 172);
        assert.equal(scenario.height(), 420);

        scenario.moveFrame(-40);
        scenario.host.dispatchEvent(new Event("scroll"));
        scenario.frameWindow.flush();
        assert.equal(scenario.top(), 220);
        assert.equal(scenario.height(), 420);

        scenario.host.visualViewport.offsetTop = 0;
        scenario.host.visualViewport.height = 844;
        scenario.moveFrame(8);
        scenario.host.visualViewport.dispatchEvent(new Event("resize"));
        scenario.frameWindow.flush();
        assert.equal(scenario.top(), 0);
        assert.equal(scenario.height(), 828);
        close();
    } finally {
        scenario.restore();
    }
});

test("closing or discarding an iframe removes host listeners and pending work", () => {
    const scenario = setup();
    try {
        const close = trackModalViewport(scenario.dialog);
        scenario.host.visualViewport.dispatchEvent(new Event("resize"));
        assert.equal(scenario.frameWindow.callbacks.size, 1);
        scenario.frameWindow.dispatchEvent(new Event("pagehide"));
        assert.equal(scenario.frameWindow.callbacks.size, 0);
        scenario.host.visualViewport.dispatchEvent(new Event("scroll"));
        scenario.host.dispatchEvent(new Event("resize"));
        assert.equal(scenario.frameWindow.callbacks.size, 0);
        close();
    } finally {
        scenario.restore();
    }
});
