
export function assertTrue(message: string, test: () => boolean) {
    try {
        const actual = test();
        if (actual) console.log(`[Success] ${message}`);
        else console.warn(`[Error] ${message}`);
    } catch (e) {
        console.error(`${message}: Error`);
        console.error(e);
    }
}

export function assertEquals(message: string, expected: string, test: () => string) {
    assertTrue(message, () => {
        const actual = test();
        if (actual && actual === expected) {
            console.log(`[Success] ${message}`);
            return true;
        } else {
            console.warn(`[Error] ${message} expected: "${expected}" actual: "${actual}"`);
            return false;
        }
    });
}

export function expectError(message: string, expectedError: string, test: () => void) {
    assertEquals(message, `Error "${expectedError}"`, () => {
        try {
            const actual = test();
            return `Result "${actual}"`;
        } catch (e: any) {
            return `Error "${e?.message}"`;
        }
    });
}
