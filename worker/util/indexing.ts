// What happens to one path while indexing. Free of syscalls, so tests/indexing.test.mts can run it in Node.

export type IndexOutcome = "indexed" | "ignored" | "unindexable";

export interface IndexLike<T> {
    has(id: string): boolean;
    add(document: T): void;
    replace(document: T): void;
    discard(id: string): void;
}

export type IndexPathOptions<T> = {
    // The `ignore` setting matches the path
    ignored: (path: string) => boolean;
    index: IndexLike<T>;
    // null when nothing can extract the file's content (no plug answers silversearch:index)
    getEntry: (path: string) => Promise<T | null>;
};

// MiniSearch's discard() throws for an id that is not in the index. A reindex starts from an empty index, so an
// ignored file used to be reported as "Failed to index" right after "Ignoring".
export function discardIfPresent(index: IndexLike<unknown>, id: string): void {
    if (index.has(id)) index.discard(id);
}

export async function indexPath<T>(path: string, options: IndexPathOptions<T>): Promise<IndexOutcome> {
    if (options.ignored(path)) {
        discardIfPresent(options.index, path);
        return "ignored";
    }

    const entry = await options.getEntry(path);
    if (!entry) {
        // Not an error: files of a type no plug indexes (html, json, audio, ...) are only skipped. A file that was
        // indexed before (its indexer plug has been removed since) leaves the index.
        discardIfPresent(options.index, path);
        return "unindexable";
    }

    if (options.index.has(path)) options.index.replace(entry);
    else options.index.add(entry);
    return "indexed";
}
