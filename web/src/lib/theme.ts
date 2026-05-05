import { createTheme } from '@mantine/core'

export const theme = createTheme({
  primaryColor: 'blue',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
  headings: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
    fontWeight: '600',
  },
  defaultRadius: 'sm',
  components: {
    Paper: {
      defaultProps: {
        withBorder: true,
        shadow: 'xs',
      },
    },
  },
})
