import "./modal.css"
import { mount } from "svelte"
import Modal from "./components/Modal.svelte"
import { waitForStylesheet } from "./util/stylesheet"

async function mountModal() {
    const path: Promise<string> = syscall("editor.getCurrentPath");
    const isDocumentEditor: Promise<string> = syscall("editor.getCurrentEditor");
    const customStyles = syscall("editor.getUiOption", "customStyles");

    await waitForStylesheet(document.querySelector<HTMLLinkElement>("link#stylesheet"));

    mount(Modal, {
        target: document.querySelector("#container")!,
        props: {
            defaultQuery: globalThis.DEFAULT_QUERY ?? "",
            currentPath: await path,
            customStyles: await customStyles,
        },
        context: new Map([
            ["isDocumentEditor", (await isDocumentEditor) !== "page"]
        ])
    });
}

mountModal();
