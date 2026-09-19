;(({ matchMedia, location }, { documentElement }) => {
  const darkColor = '#0d1117'
  const lightColor = '#ffffff'
  const media = matchMedia('(prefers-color-scheme: dark)')
  const dark = new URLSearchParams(location.search).get('dark')
  const theme = dark === 'true' ? 'dark' : dark === 'false' ? 'light' : 'system'
  const handleChange = () => {
    const dark = theme === 'dark' || (theme === 'system' && media.matches)
    documentElement.classList.toggle('dark', dark)
    documentElement.setAttribute('data-theme', theme)
    documentElement
      .querySelector('meta[name="theme-color"]')
      .setAttribute('content', dark ? darkColor : lightColor)
  }
  handleChange()
  media.addEventListener('change', handleChange)
})(window, document)
