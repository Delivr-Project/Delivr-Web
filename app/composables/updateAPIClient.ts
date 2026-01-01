import { client } from "@/api-client/client.gen";

export function updateAPIClient(token: string | null) {

    const apiURL = useRuntimeConfig().public.apiUrl;

    if (token) {
        client.setConfig({
            baseURL: apiURL,
            headers: {
                Authorization: `Bearer ${token}`
            },
            ignoreResponseError: true
        });
    } else {
        client.setConfig({
            baseURL: apiURL,
            ignoreResponseError: true
        });
    }
}