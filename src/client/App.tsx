import { Page } from "./Page";

export class App<T extends Record<string, string> = any> {
    pageName!: keyof T & string;
    page!: Page;

    static LOCAL_STORAGE_PAGE_KEY = 'app_page';

    constructor(readonly pages: T) {
    }

    async start() {
        await this.loadPage();
        this.page.start(this);
    }

    protected async loadPage() {
        this.pageName = ((localStorage.getItem(App.LOCAL_STORAGE_PAGE_KEY) as keyof T)) as any;
        if (!this.pageName || !this.pages[this.pageName]) this.pageName = Object.keys(this.pages)[0];
        let pageUrl = this.pages[this.pageName];
        let pageInstance: any;
        if (pageUrl) {

            if (!pageUrl.startsWith('../')) {
                pageUrl = "../" + pageUrl as any;
            }
            let module = (await import(pageUrl));
            pageInstance = module.default;
        } else pageInstance = DefaultPage;

        if (typeof pageInstance === 'function') pageInstance = new pageInstance(this);
        if (!pageInstance) {
            throw Error(`Page ${this.pageName} does not have a default export function.`);

        }
        if (!(pageInstance instanceof Page)) {
            throw Error(`File ${pageUrl} did not return a page or a page class.`);
        }
        this.page = pageInstance;
    }


}

class DefaultPage extends Page {
    async run(): Promise<void> {

    }

}
