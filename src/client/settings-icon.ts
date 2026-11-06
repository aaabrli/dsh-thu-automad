/**
 * Paint this plugin's glyph into its own Settings navigation button.
 *
 * The Settings sidebar is owned by the shell: every plugin's category is a
 * plain `<button>` with a generic gear glyph, and the shell does not read a
 * package icon for that seat. The neighbouring plugins solve it the same way:
 * mark the button whose text is this plugin's category label and let CSS replace
 * the glyph inside it with a mask of the plugin's own SVG. The mask paints with
 * `currentColor`, so the icon follows the theme and the shell's hover/selected
 * colors without shipping a second artwork.
 *
 * The dialog is destroyed and rebuilt between openings, so the marker is
 * re-applied by a MutationObserver rather than only once at mount.
 * @module dsh-thu-automad/client/settings-icon
 */

/** Attribute the stylesheet keys on; unique to this plugin. */
const MARK = 'thu-automad'

/**
 * Install the settings-nav glyph.
 * @param labels - the configured category label in every locale.
 * @param glyph - the plugin's SVG source.
 * @returns a disposer removing the stylesheet, observer, and marker.
 */
export function installSettingsIcon(labels: readonly string[], glyph: string): () => void {
  const style = document.createElement('style')
  const selector = `button[data-dsh-plugin-icon="${MARK}"] svg`
  style.textContent = `${selector}{width:16px;height:16px;flex-shrink:0;display:block;`
    + `background:currentColor;mask:url("data:image/svg+xml,${encodeURIComponent(glyph)}") center/contain no-repeat}`
    + `${selector}>*{visibility:hidden}`
  document.head.appendChild(style)

  const update = (): void => {
    const wanted = new Set(labels)
    for (const button of document.querySelectorAll('[role="dialog"][data-shortcut-modal="settings"] nav button')) {
      if (wanted.has(button.textContent?.trim() ?? '')) button.setAttribute('data-dsh-plugin-icon', MARK)
    }
  }
  const observer = new MutationObserver(update)
  observer.observe(document.body, { childList: true, subtree: true })
  update()

  return () => {
    observer.disconnect()
    style.remove()
    for (const item of document.querySelectorAll(`[data-dsh-plugin-icon="${MARK}"]`)) {
      item.removeAttribute('data-dsh-plugin-icon')
    }
  }
}