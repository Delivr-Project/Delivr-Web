
export function useAppURL() {
    const config = useRuntimeConfig();
    return config.public.appUrl;
}
