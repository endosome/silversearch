import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { waitForStylesheet } from "../modal/util/stylesheet.ts";

class Stylesheet extends EventTarget {
    sheet: object | null = null;

    asLink() {
        return this as unknown as HTMLLinkElement;
    }
}

test("slow stylesheet loading does not reveal the dialog after 75ms", async () => {
    const stylesheet = new Stylesheet();
    let ready = false;
    const waiting = waitForStylesheet(stylesheet.asLink()).then(() => { ready = true; });
    await setTimeout(100);
    assert.equal(ready, false);
    stylesheet.sheet = {};
    stylesheet.dispatchEvent(new Event("load"));
    await waiting;
    assert.equal(ready, true);
});

test("an already loaded stylesheet needs no further load event", async () => {
    const stylesheet = new Stylesheet();
    stylesheet.sheet = {};
    await waitForStylesheet(stylesheet.asLink());
});

test("missing or failed styles do not leave the dialog waiting indefinitely", async () => {
    await waitForStylesheet(null);
    const stylesheet = new Stylesheet();
    const waiting = waitForStylesheet(stylesheet.asLink());
    stylesheet.dispatchEvent(new Event("error"));
    await waiting;
});
