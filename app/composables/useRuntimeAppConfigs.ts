
export function useRuntimeAppConfigs() {
    const config = useRuntimeConfig();
    return config.public;
}

