export default defineAppConfig({
  ui: {
    primary: 'purple',
    secondary: 'pink',
    gray: 'cool',
    button: {
      rounded: 'rounded-full',
      default: {
        size: 'md'
      }
    },
    input: {
      default: {
        size: 'md'
      }
    },
    card: {
      rounded: 'rounded-xl'
    },
    footer: {
      top: {
        wrapper: 'border-t border-gray-200 dark:border-gray-800',
        container: 'py-8 lg:py-16'
      },
      bottom: {
        wrapper: 'border-t border-gray-200 dark:border-gray-800'
      }
    },
    page: {
      hero: {
        wrapper: 'lg:py-24'
      }
    },
    landing: {
      section: {
        wrapper: 'py-16 sm:py-24'
      },
      hero: {
        wrapper: 'py-16 sm:py-16 lg:py-16'
      }
    }
  }
})
