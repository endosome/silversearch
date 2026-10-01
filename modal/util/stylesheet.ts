/** Wait for the shared SilverBullet styles, including a cached load. */
export function waitForStylesheet(stylesheet: HTMLLinkElement | null): Promise<void> {
    if (!stylesheet || stylesheet.sheet) return Promise.resolve();

    return new Promise((resolve) => {
        const finish = () => {
            stylesheet.removeEventListener("load", finish);
            stylesheet.removeEventListener("error", finish);
            resolve();
        };

        stylesheet.addEventListener("load", finish);
        // A failed request should still allow the user to close/use the dialog.
        stylesheet.addEventListener("error", finish);
    });
}
