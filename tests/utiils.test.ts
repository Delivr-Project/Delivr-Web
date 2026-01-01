/// <reference types="bun-types/test.d.ts" />
import { describe, test, expect } from 'bun:test';
import { SimpleRouteMatcher } from '../app/utils/routeMatcher.ts';

describe('Testing SimpleRouteMatcher Utility', () => {

    const routes = [
        "/page",
        "/page/[page_name]",
        "/page/new",
        "/page/[page_name]/edit"
    ];

    test('should match /page route correctly', async () => {

        const result = await SimpleRouteMatcher.match("/page", routes);
        // assert(result !== null, "Expected a match for /page");
        // assert(result.route === "/page", `Expected route to be /page but got ${result.route}`);
        // assert(Object.keys(result.params).length === 0, `Expected no params but got ${JSON.stringify(result.params)}`);
        // { route: '/page', params: {} }
        expect(result).not.toBeNull();
        expect(result?.route).toBe("/page");
        expect(Object.keys(result!.params).length).toBe(0);

    });

    test('should match /page/[page_name] route correctly', async () => {

        const result = await SimpleRouteMatcher.match("/page/test", routes);
        // assert(result !== null, "Expected a match for /page/test");
        // assert(result.route === "/page/[page_name]", `Expected route to be /page/[page_name] but got ${result.route}`);
        // assert(result.params.page_name === "test", `Expected page_name to be test but got ${result.params.page_name}`);
        // { route: '/page/[page_name]', params: { page_name: 'test' } }
        expect(result).not.toBeNull();
        expect(result?.route).toBe("/page/[page_name]");
        expect(result?.params.page_name).toBe("test");

    });

    test('should match /page/[page_name]/edit route correctly', async () => {

        const result = await SimpleRouteMatcher.match("/page/test/edit", routes);
        // assert(result !== null, "Expected a match for /page/test/edit");
        // assert(result.route === "/page/[page_name]/edit", `Expected route to be /page/[page_name]/edit but got ${result.route}`);
        // assert(result.params.page_name === "test", `Expected page_name to be test but got ${result.params.page_name}`);
        // { route: '/page/[page_name]/edit', params: { page_name: 'test' } }
        expect(result).not.toBeNull();
        expect(result?.route).toBe("/page/[page_name]/edit");
        expect(result?.params.page_name).toBe("test");

    });

    test('should return null for non-matching routes', async () => {

        const result = await SimpleRouteMatcher.match("/other", routes);
        // assert(result === null, "Expected no match for /other");
        // null
        expect(result).toBeNull();
    });

    test('should handle trailing slashes correctly', async () => {

        const result = await SimpleRouteMatcher.match("/page/test/", routes);
        // assert(result !== null, "Expected a match for /page/test/");
        // assert(result.route === "/page/[page_name]", `Expected route to be /page/[page_name] but got ${result.route}`);
        //assert(result.params.page_name === "test", `Expected page_name to be test but got ${result.params.page_name}`);
        // { route: '/page/[page_name]', params: { page_name: 'test' } }
        expect(result).not.toBeNull();
        expect(result?.route).toBe("/page/[page_name]");
        expect(result?.params.page_name).toBe("test");

    });

    test('should prioritize static routes over dynamic ones', async () => {

        const result = await SimpleRouteMatcher.match("/page/new", routes);
        expect(result).not.toBeNull();
        expect(result?.route).toBe("/page/new");
        expect(Object.keys(result!.params).length).toBe(0);

    });

    test('should return dynamic route for static with subpath', async () => {

        const result = await SimpleRouteMatcher.match("/page/new/edit", routes);
        expect(result).not.toBeNull();
        expect(result?.route).toBe("/page/[page_name]/edit");
        expect(result?.params.page_name).toBe("new");

    });

    test('should return null for incomplete dynamic routes', async () => {

        const result = await SimpleRouteMatcher.match("/page/test/edit/more", routes);
        expect(result).toBeNull();

    });

});