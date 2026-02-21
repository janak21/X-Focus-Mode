# X Focus Mode

A sleek, premium Chrome Extension designed to eliminate distractions on X (formerly Twitter) and provide a pure, focused reading experience. 

## Features
X Focus Mode transforms the default X interface into a minimalist reading environment.
* **Hide Sidebars**: Instantly removes the left navigation menu and the right timeline (trends, "Who to follow", etc.).
* **Wide Layout**: Expands the main reading column from the default 600px up to 900px, utilizing your screen space efficiently.
* **Zen Typography**: Increases font size, improves line height, and softens text color to reduce eye strain for long-form reading.

All features can be toggled independently via a clean, native-feeling Chrome extension popup.

## Privacy & Security
This extension runs **100% locally** in your browser. It purely uses CSS injection and `MutationObserver` DOM manipulation to hide HTML elements.
* No data is sent to external servers.
* No authentication or account access is required.
* Zero risk of triggering API limits or account bans.

## Installation (Developer Mode)
Currently, this extension is not published to the Chrome Web Store. To install it locally:

1. Clone or download this repository to your local machine:
   ```bash
   git clone https://github.com/yourusername/X-Post-Reader.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Toggle on **"Developer mode"** in the top right corner.
4. Click the **"Load unpacked"** button in the top left corner.
5. Select the folder containing this repository's files.
6. The extension will appear in your Chrome toolbar. Click the puzzle icon and pin it for easy access!

## Usage
1. Navigate to [x.com](https://x.com).
2. Click the **X Focus Mode** icon in your Chrome toolbar.
3. Use the toggle switches in the popup to customize your reading experience:
   * **Hide Sidebars**: Removes the left and right clutter.
   * **Wide Layout**: Expands the reading area to 900px wide.
   * **Zen Typography**: Switches to a larger, softer font for easier reading.

## Tech Stack
* **Manifest V3**: Using modern Chrome Extension architecture.
* **Vanilla JavaScript & CSS**: Zero dependencies for maximum performance and security.
* CSS `!important` overriding to ensure styles persist across single-page application (SPA) mutations.

## Creating Extension Icons
If you wish to modify the icons, ensure you replace the following files in the root directory with your own PNG assets, keeping the dimensions exact:
* `icon16.png` (16x16)
* `icon48.png` (48x48)
* `icon128.png` (128x128)

## Contributing
Pull requests are welcome! If you have ideas for new features (e.g., hiding engagement metrics, "pure text" mode), feel free to open an issue or submit a PR.

## License
MIT License - use this freely to improve your focus flow!
