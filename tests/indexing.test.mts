import assert from "node:assert/strict";
import { test } from "node:test";
import MiniSearch from "@endosome/minisearch";
import { indexPath } from "../worker/util/indexing.ts";

type Doc = { path: string; content: string };

function engine() {
    return new MiniSearch<Doc>({ idField: "path", fields: ["content"] });
}

const ignoredTypes = (path: string) => /\.(mp3|png|pdf)$/.test(path);
const markdownOnly = async (path: string): Promise<Doc | null> =>
    path.endsWith(".md") ? { path, content: "zebra " + path } : null;

test("an ignored file that was never indexed is ignored, not a failure", async () => {
    const index = engine();
    assert.throws(() => index.discard("audio/12_`Credits.mp3"), /not in the index/);
    const outcome = await indexPath("audio/12_`Credits.mp3", { ignored: ignoredTypes, index, getEntry: markdownOnly });
    assert.equal(outcome, "ignored");
    assert.equal(index.documentCount, 0);
});

test("a file without an indexer is skipped, not a failure", async () => {
    const index = engine();
    for (const path of ["ad/page.html", "ad/raw/api-offer.json"]) {
        assert.equal(await indexPath(path, { ignored: ignoredTypes, index, getEntry: markdownOnly }), "unindexable");
    }
    assert.equal(index.documentCount, 0);
});

test("a file indexed before leaves the index once it is ignored or has no indexer any more", async () => {
    const index = engine();
    index.add({ path: "docs/manual.pdf", content: "manual" });
    index.add({ path: "ad/page.html", content: "page" });
    assert.equal(await indexPath("docs/manual.pdf", { ignored: ignoredTypes, index, getEntry: markdownOnly }), "ignored");
    assert.equal(await indexPath("ad/page.html", { ignored: ignoredTypes, index, getEntry: markdownOnly }), "unindexable");
    assert.equal(index.documentCount, 0);
});

test("pages are added once and replaced on the next run", async () => {
    const index = engine();
    const options = { ignored: ignoredTypes, index, getEntry: markdownOnly };
    assert.equal(await indexPath("notes/page.md", options), "indexed");
    assert.equal(await indexPath("notes/page.md", options), "indexed");
    assert.equal(index.documentCount, 1);
    assert.equal(index.search("zebra").length, 1);
});
