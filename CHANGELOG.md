# Changelog

## 0.3.7
- Add Offset style (renamed from Normal) with a shifted highlight.
- Fix Offset text color for readability.

## 0.3.6
- Fix Trusted Types error in Gmail by avoiding innerHTML.

## 0.3.5
- Replace the style dropdown with a visual preview picker.

## 0.3.4
- Replace Neon with a Synthwave-style highlight.

## 0.3.3
- Add Pastel and Neon highlight styles and style the menu labels.

## 0.3.2
- Remove black sticker border and add a slight tilt.

## 0.3.1
- Resolve overlap between highlight and exclude by prioritizing exact excludes.

## 0.3.0
- Keep the popup anchored above the HL button after dragging.

## 0.2.9
- Make highlighted text bold by default for better readability.

## 0.2.8
- Switch drag handling to mouse events for better Gmail compatibility.

## 0.2.7
- Avoid innerHTML in Gmail by building the icon node safely.

## 0.2.6
- Use a Font Awesome icon for the HL bubble.

## 0.2.5
- Make the HL bubble draggable with the overlay.

## 0.2.4
- Ensure excluded phrases block nested highlight matches.
- Match multi-word phrases across more whitespace variants.

## 0.2.3
- Make exclude matching strict for multi-word phrases with word boundaries.

## 0.2.2
- Rename Sticker v1 style to Origami (auto-migrate saved choice).

## 0.2.1
- Add style selector (Normal/Bold/Sticker/Origami/Candy).
- Add Sticker v1 and Candy styles with dedicated CSS.
- Improve Gmail compatibility (Trusted Types-safe UI, document-start injection).
- Increase sticker rounding and visual emphasis.

## 0.2.0
- Add highlight/exclude UI and persistent settings per hostname.
- Add multiple highlight styles and dynamic re-apply on DOM changes.

## 0.1.0
- Initial userscript with keyword highlight and exclude.
