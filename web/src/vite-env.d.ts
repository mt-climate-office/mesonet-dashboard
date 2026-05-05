/// <reference types="vite/client" />

declare module 'plotly.js-dist-min' {
  // The dist-min bundle exposes the same surface as plotly.js. We only use a
  // small slice of it (Plot.react via the react-plotly.js factory), so we
  // type it loosely and let consumers narrow when they need to.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Plotly: any
  export default Plotly
}
