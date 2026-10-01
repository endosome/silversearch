<script lang="ts" generics="Element">
    import { tick, type Snippet } from "svelte";
    import ResultContainer from "./ResultContainer.svelte";
    import ResultApology from "./ResultApology.svelte";
    import SearchApology from "./SearchApology.svelte";
    import SearchTips from "./SearchTips.svelte";
    import { query } from "./query.svelte";
    import { trackModalViewport } from "../util/viewport";

    let {
        search,
        open,

        helpText,

        elementTitle,
        elementDescription,
        elementInfo,
    }: {
        search: (query: string) => Promise<Element[]>;
        open: (element: Element, openInNewTab: boolean, openSpecial: boolean) => Promise<void>;

        helpText: Snippet;

        elementTitle?: Snippet<[Element]>;
        elementDescription: Snippet<[Element]>;
        elementInfo?: Snippet<[Element]>;
    } = $props();

    let dialog: HTMLDialogElement;
    let resultList: HTMLDivElement;

    // We can't use the `open` property on the dialog, because then some events don't fire
    $effect(() => {
        const cleanup = trackModalViewport(dialog);
        dialog.showModal();
        return cleanup;
    });

    function onClickWindow() {
        syscall("editor.hidePanel", "modal");
    }

    let results: Element[] = $state([]);
    let searching = $state(false);
    let selectedIndex = $state(0);

    $effect(() => {
        if (query.historyIndex >= 0) query.history[query.historyIndex] = query.text;
    })

    $effect(() => {
        if (query.text) {
            updateResults();
        } else {
            results = [];
            searching = false;
        }
    });

    let cancelPromise: PromiseWithResolvers<never> | null = null;
    async function updateResults() {
        searching = true;

        if (cancelPromise) {
            cancelPromise.reject();
            cancelPromise = null;
        }
        cancelPromise = Promise.withResolvers();

        try {
            results = await Promise.race([
                search(query.text),
                cancelPromise.promise,
            ]);

            cancelPromise = null;
            selectedIndex = 0;
            scrollIntoView();
            searching = false;
        } catch {}
    }

    async function openSelected(openInNewTab: boolean, openSpecial: boolean) {
        if (results.length === 0) return;

        if (query.text) query.history.unshift(query.text);
        query.history = query.history.filter(x => x);
        if (query.history.length > 50) query.history.pop();
        syscall("clientStore.set", "silversearch-history", [...query.history]);

        await open(results[selectedIndex], openInNewTab, openSpecial);

        await syscall("editor.hidePanel", "modal");
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            openSelected(e.ctrlKey, e.altKey);
            return;
        }

        if (e.ctrlKey) {
            const previousIndex = query.historyIndex;
            if (previousIndex === -1) query.buffer = query.text;

            // We are moving in the history
            if (e.key === "ArrowUp") query.historyIndex++;
            else if (e.key === "ArrowDown") query.historyIndex--;
            else return;

            query.historyIndex = Math.max(-1, Math.min(query.historyIndex, query.history.length - 1))

            if (previousIndex != query.historyIndex && query.historyIndex >= 0) query.text = query.history[query.historyIndex];
            else if (query.historyIndex === -1) query.text = query.buffer;
        } else {
            // We are moving in the results
            if (e.key === "ArrowUp") selectedIndex--;
            else if (e.key === "ArrowDown") selectedIndex++;
            else return;

            selectedIndex = Math.max(0, Math.min(selectedIndex, results.length - 1));
        }

        e.preventDefault();
        scrollIntoView();
    }

    async function scrollIntoView() {
        await tick();

        const element = resultList?.querySelector(".silversearch-selected");
        if (!element) return;

        // scrollIntoView also scrolls ancestor documents, which can push the
        // search field out of view in a mobile panel iframe.
        const item = element.getBoundingClientRect();
        const list = resultList.getBoundingClientRect();
        if (item.top < list.top) {
            resultList.scrollTop += item.top - list.top;
        } else if (item.bottom > list.bottom) {
            resultList.scrollTop += Math.min(item.bottom - list.bottom, item.top - list.top);
        }
    }
</script>

<svelte:window onclick={onClickWindow} />

<dialog
    class="silversearch-modal-box"
    oncancel={(e: Event) => {
        e.preventDefault();
        syscall("editor.hidePanel", "modal");
    }}
    bind:this={dialog}
>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="silversearch-header"
        onclick={(e: Event) => e.stopPropagation()}
        onkeydown={onKeyDown}
    >
        <label for="mini-editor">Search</label>
        <input
            id="mini-editor"
            class="silversearch-input"
            placeholder="Search with Silversearch"
            autocomplete="off"
            bind:value={query.text}
        />
    </div>
    <div class="silversearch-help-text">{@render helpText()}</div>
    <div class="silversearch-result-list" bind:this={resultList}>
        {#each results as result, i}
            <ResultContainer
                selected={i === selectedIndex}
                onclick={({ ctrlKey, altKey }) => openSelected(ctrlKey, altKey)}
                onmousemove={() => (selectedIndex = i)}
            >
                {#snippet title()}
                    {#if elementTitle}
                        {@render elementTitle(result)}
                    {/if}
                {/snippet}
                {#snippet description()}
                    {@render elementDescription(result)}
                {/snippet}
                {#snippet info()}
                    {#if elementInfo}
                        {@render elementInfo(result)}
                    {/if}
                {/snippet}
            </ResultContainer>
        {:else}
            {#if !searching && query.text}
                <ResultApology/>
            {:else if !searching}
                <SearchTips/>
            {:else if searching}
                <SearchApology/>
            {/if}
        {/each}
    </div>
</dialog>

<style>
    dialog.silversearch-modal-box {
        padding: 0;
        width: 700px;
        max-width: 90%;
        color: var(--modal-color);
        background-color: var(--modal-background-color);
        border: 1px solid var(--modal-border-color);
        border-radius: var(--ui-radius-xl);
        box-shadow: 0 24px 60px var(--modal-shadow-color);
        --silversearch-modal-top: 60px;
        outline: none;
        /* Own the geometry instead of inheriting page-level modal positioning. */
        position: fixed;
        inset: 0 0 auto;
        top: var(--silversearch-viewport-top, 0px);
        margin: var(--silversearch-modal-top) auto 0;
        box-sizing: border-box;
        max-height: calc(100vh - var(--silversearch-modal-top) - 8px);
        max-height: calc(100dvh - var(--silversearch-modal-top) - 8px);
        max-height: calc(var(--silversearch-viewport-height, 100dvh) - var(--silversearch-modal-top) - 8px);
        overflow: hidden;
    }

    dialog[open] {
        display: flex;
        flex-direction: column;
    }

    .silversearch-header, .silversearch-help-text {
        flex-shrink: 0;
    }

    @media (max-width: 600px), (max-height: 500px) {
        dialog.silversearch-modal-box {
            /* The dialog's top layer is confined to the panel iframe. Leave
               room for SilverBullet's title bar in the parent document, too.
               SilverBullet 2.10 has a 55px bar but no --sb-top-height token. */
            --silversearch-modal-top: calc(8px + var(--sb-top-height, 55px) + var(--sb-standalone-top-offset, 0px));
        }
    }

    dialog::backdrop {
        background-color: var(--modal-backdrop-color);
    }

    .silversearch-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 13px 10px 10px;
    }

    .silversearch-header label {
        color: var(--modal-header-label-color);
        font-weight: 600;
        white-space: nowrap;
    }

    .silversearch-input {
        flex: 1;
        min-width: 0;
        padding: 0;
        background: none;
        border: 0;
        outline: none;
        color: inherit;
        font: inherit;
        caret-color: var(--editor-caret-color);
    }

    .silversearch-input::placeholder {
        color: var(--modal-description-color);
    }

    .silversearch-help-text {
        padding: 0 10px 8px;
        color: var(--modal-help-color);
        font-size: 12px;
        line-height: 1.5;
    }

    .silversearch-result-list {
        min-height: 0;
        max-height: 80vh;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 2px 8px 8px;
    }

    @media (pointer: coarse) {
        .silversearch-input {
            /* Prevent iOS from zooming the page when the input receives focus. */
            font-size: max(16px, 1em);
        }
    }
</style>
