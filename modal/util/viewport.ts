/** Keep an iframe dialog inside the host's visible area after keyboard panning. */
export function trackModalViewport(dialog: HTMLDialogElement): () => void {
    const frame = window.frameElement;
    const host = frame?.ownerDocument.defaultView ?? window;
    const viewport = host.visualViewport;
    let pendingFrame = 0;

    function update() {
        pendingFrame = 0;
        // An iframe's own visualViewport does not reflect the mobile keyboard.
        // Map the host viewport into this iframe's coordinate system instead.
        const frameTop = frame ? frame.getBoundingClientRect().top + frame.clientTop : 0;
        const visibleTop = Math.max(0, (viewport?.offsetTop ?? 0) - frameTop);
        const visibleBottom = Math.min(
            window.innerHeight,
            (viewport?.offsetTop ?? 0) + (viewport?.height ?? host.innerHeight) - frameTop,
        );
        dialog.style.setProperty("--silversearch-viewport-top", `${visibleTop}px`);
        dialog.style.setProperty("--silversearch-viewport-height", `${Math.max(0, visibleBottom - visibleTop)}px`);
    }

    function scheduleUpdate() {
        if (!pendingFrame) pendingFrame = window.requestAnimationFrame(update);
    }

    viewport?.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    host.addEventListener("resize", scheduleUpdate);
    host.addEventListener("scroll", scheduleUpdate);
    if (host !== window) window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("pagehide", cleanup);
    update();

    function cleanup() {
        window.cancelAnimationFrame(pendingFrame);
        viewport?.removeEventListener("resize", scheduleUpdate);
        viewport?.removeEventListener("scroll", scheduleUpdate);
        host.removeEventListener("resize", scheduleUpdate);
        host.removeEventListener("scroll", scheduleUpdate);
        if (host !== window) window.removeEventListener("resize", scheduleUpdate);
        window.removeEventListener("pagehide", cleanup);
    }

    return cleanup;
}
