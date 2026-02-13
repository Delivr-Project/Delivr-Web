export default defineAppConfig({
    ui: {
        colors: {
            primary: 'sky',
            neutral: 'slate'
        },

        dashboardSidebar: {
            slots: {
                root: "min-h-full"
            }
        },
        dashboardPanel: {
            slots: {
                root: "min-h-full"
            }
        }
    },
    theme: {
        radius: 0.5,
        blackAsPrimary: false
    }
})
